# backend/app/models/allocation_engine.py
# Resource Allocation Engine.
#
# Given a fixed municipal "budget" of physical resources:
#   - pumps       (e.g. 5  mobile pumping units)
#   - trucks      (e.g. 10 water-tanker / drain-cleaning trucks)
#   - worker_days (e.g. 20 drain-cleaning crew-days)
#
# ...and the list of all streets with risk scores, return:
#   - top-N priority streets
#   - recommended resource assignment per street
#   - rationale for each assignment
#
# Algorithm: greedy priority queue + rule-based resource matching.
# (A full ILP / OR-Tools solver is overkill for a hackathon MVP; greedy
#  gives explainable, near-optimal assignments for small city instances.)

from __future__ import annotations
import heapq
from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class StreetRiskEntry:
    """Lightweight view of a street used by the allocation engine."""
    id: str
    name: str
    risk_score: float           # 0–100
    zone: str
    drainage_status: str        # good | partial | blocked
    population_density: float   # persons / km²
    historical_reports: int
    lat: float = 0.0
    lng: float = 0.0
    resources_assigned: list = field(default_factory=list)

    # Allow heapq comparisons (we use negative score for max-heap)
    def __lt__(self, other):
        return self.risk_score > other.risk_score   # higher score = higher priority


@dataclass
class ResourceBudget:
    """Available municipal resources."""
    pumps: int = 5
    trucks: int = 10
    worker_days: int = 20


@dataclass
class AllocationResult:
    """One street's allocation recommendation."""
    street_id: str
    street_name: str
    zone: str
    risk_score: float
    priority_rank: int
    assigned_resources: list[str]   # e.g. ["pump", "truck", "workers:2"]
    impact_score: float             # estimated impact of allocation (0–100)
    rationale: str


# ---------------------------------------------------------------------------
# Resource matching rules
# ---------------------------------------------------------------------------

def _recommend_resources(street: StreetRiskEntry, budget: ResourceBudget) -> tuple[list[str], str, float]:
    """
    Rule-based resource assignment for a single street.

    Returns:
        (assigned_resources, rationale, impact_score)
    """
    assigned = []
    reasons = []
    impact = 0.0

    # --- Pump: deploy when score is high AND drainage is blocked/partial ---
    if budget.pumps > 0 and street.risk_score >= 60 and street.drainage_status in ("blocked", "partial"):
        assigned.append("pump")
        budget.pumps -= 1
        reasons.append("high risk + impaired drainage → pump needed")
        impact += 35

    # --- Truck: drain-cleaning or water-removal truck ---
    # Deploy when drainage is blocked, or score is very high
    if budget.trucks > 0 and (street.drainage_status == "blocked" or street.risk_score >= 75):
        assigned.append("truck")
        budget.trucks -= 1
        reasons.append("blocked drain or critical score → truck for drain clearing")
        impact += 30

    # --- Workers: always send at least a small crew to high-risk streets ---
    # Workers needed scales with severity
    if street.risk_score >= 80 and budget.worker_days >= 3:
        crew = 3
    elif street.risk_score >= 60 and budget.worker_days >= 2:
        crew = 2
    elif street.risk_score >= 40 and budget.worker_days >= 1:
        crew = 1
    else:
        crew = 0

    if crew > 0 and budget.worker_days >= crew:
        assigned.append(f"workers:{crew}")
        budget.worker_days -= crew
        reasons.append(f"{crew} worker-day(s) for manual drain clearing")
        impact += crew * 8

    # Boost impact for dense neighbourhoods (more people benefit)
    if street.population_density > 30_000:
        impact *= 1.2

    # Cap at 100
    impact = round(min(100.0, impact), 1)

    if not assigned:
        rationale = "No resources available or risk below threshold"
    else:
        rationale = "; ".join(reasons)

    return assigned, rationale, impact


# ---------------------------------------------------------------------------
# Main allocation function
# ---------------------------------------------------------------------------

def allocate_resources(
    streets: list[StreetRiskEntry],
    budget: ResourceBudget,
    top_n: int = 10,
    min_risk_threshold: float = 30.0,
) -> list[AllocationResult]:
    """
    Allocate municipal resources to the highest-risk streets.

    Args:
        streets:             All street entries with risk scores.
        budget:              Available resources (mutated in-place).
        top_n:               Maximum number of streets to allocate to.
        min_risk_threshold:  Streets below this score are skipped.

    Returns:
        List of AllocationResult, sorted by priority rank (1 = highest).
    """
    # Filter out streets below threshold, then sort by risk score descending
    eligible = [s for s in streets if s.risk_score >= min_risk_threshold]
    eligible.sort(key=lambda s: s.risk_score, reverse=True)

    results: list[AllocationResult] = []

    for rank, street in enumerate(eligible[:top_n], start=1):
        # Stop early if all resources are exhausted
        if budget.pumps == 0 and budget.trucks == 0 and budget.worker_days == 0:
            break

        assigned, rationale, impact = _recommend_resources(street, budget)

        results.append(AllocationResult(
            street_id=street.id,
            street_name=street.name,
            zone=street.zone,
            risk_score=street.risk_score,
            priority_rank=rank,
            assigned_resources=assigned,
            impact_score=impact,
            rationale=rationale,
        ))

    return results


# ---------------------------------------------------------------------------
# Firestore-backed convenience wrapper
# ---------------------------------------------------------------------------

def allocate_from_firestore(
    db,
    budget: Optional[ResourceBudget] = None,
    top_n: int = 10,
    weights: dict | None = None,
) -> dict:
    """
    Load streets from Firestore, run allocation, and return a JSON-friendly dict.

    Args:
        db:      Firestore client.
        budget:  ResourceBudget; defaults to (5 pumps, 10 trucks, 20 worker-days).
        top_n:   How many streets to return.
        weights: Current risk weights (from risk_config/current). Used only
                 for display; actual scores are already stored in Firestore.

    Returns:
        dict with keys: budget_used, budget_remaining, allocations, summary.
    """
    if budget is None:
        budget = ResourceBudget()

    # Load streets from Firestore
    docs = db.collection("streets").stream()
    streets = []
    for doc in docs:
        d = doc.to_dict()
        streets.append(StreetRiskEntry(
            id=doc.id,
            name=d.get("name", ""),
            risk_score=d.get("risk_score", 0),
            zone=d.get("zone", ""),
            drainage_status=d.get("drainage_status", "good"),
            population_density=d.get("population_density", 10_000),
            historical_reports=d.get("historical_reports", 0),
            lat=d.get("lat", 0.0),
            lng=d.get("lng", 0.0),
        ))

    # Snapshot original budget for reporting
    original = ResourceBudget(
        pumps=budget.pumps,
        trucks=budget.trucks,
        worker_days=budget.worker_days,
    )

    results = allocate_resources(streets, budget, top_n=top_n)

    # Serialise
    allocations = []
    for r in results:
        allocations.append({
            "street_id": r.street_id,
            "street_name": r.street_name,
            "zone": r.zone,
            "risk_score": r.risk_score,
            "priority_rank": r.priority_rank,
            "assigned_resources": r.assigned_resources,
            "impact_score": r.impact_score,
            "rationale": r.rationale,
        })

    return {
        "budget_allocated": {
            "pumps": original.pumps,
            "trucks": original.trucks,
            "worker_days": original.worker_days,
        },
        "budget_remaining": {
            "pumps": budget.pumps,
            "trucks": budget.trucks,
            "worker_days": budget.worker_days,
        },
        "streets_evaluated": len(streets),
        "streets_allocated": len(results),
        "allocations": allocations,
        "summary": _summarise(results, original, budget),
    }


def _summarise(results: list[AllocationResult], original: ResourceBudget, remaining: ResourceBudget) -> str:
    """Return a plain-English summary string for the dashboard."""
    if not results:
        return "No streets met the risk threshold. No resources allocated."

    pumps_used = original.pumps - remaining.pumps
    trucks_used = original.trucks - remaining.trucks
    workers_used = original.worker_days - remaining.worker_days
    top = results[0]
    return (
        f"Allocated to {len(results)} streets. "
        f"Highest risk: {top.street_name} (score {top.risk_score:.1f}). "
        f"Resources deployed: {pumps_used} pump(s), {trucks_used} truck(s), "
        f"{workers_used} worker-day(s)."
    )


# ---------------------------------------------------------------------------
# Quick self-test (run: python -m app.models.allocation_engine)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Synthetic streets for local testing
    test_streets = [
        StreetRiskEntry("s1", "Rashbehari Ave",   risk_score=92, zone="south",   drainage_status="blocked",  population_density=55_000, historical_reports=18),
        StreetRiskEntry("s2", "Park Street",       risk_score=78, zone="central", drainage_status="partial",  population_density=35_000, historical_reports=10),
        StreetRiskEntry("s3", "Ballygunge Circular",risk_score=65, zone="south",  drainage_status="partial",  population_density=28_000, historical_reports=6),
        StreetRiskEntry("s4", "VIP Road",          risk_score=55, zone="north",   drainage_status="good",     population_density=20_000, historical_reports=3),
        StreetRiskEntry("s5", "Salt Lake Sec V",   risk_score=40, zone="east",    drainage_status="good",     population_density=12_000, historical_reports=1),
        StreetRiskEntry("s6", "Gariahat Road",     risk_score=25, zone="south",   drainage_status="good",     population_density=8_000,  historical_reports=0),
    ]

    budget = ResourceBudget(pumps=3, trucks=5, worker_days=12)
    results = allocate_resources(test_streets, budget, top_n=5)

    print(f"{'Rank':<5} {'Street':<25} {'Score':>6} {'Resources':<35} {'Impact':>7}")
    print("-" * 80)
    for r in results:
        res_str = ", ".join(r.assigned_resources) or "none"
        print(f"{r.priority_rank:<5} {r.street_name:<25} {r.risk_score:>6.1f} {res_str:<35} {r.impact_score:>7.1f}")

    print(f"\nRemaining: {budget.pumps} pumps, {budget.trucks} trucks, {budget.worker_days} worker-days")
