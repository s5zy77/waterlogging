# backend/app/models/risk_scoring.py
# Waterlogging Risk Score model.
#
# Score range: 0 – 100  (higher = more at risk)
#
# The four input factors and their default weights:
#
#   Factor               Raw signal             Direction
#   -------              ----------             ---------
#   Elevation            metres above sea level low elev  → high risk
#   Drainage status      good/partial/blocked   blocked   → high risk
#   Population density   persons / km²          high dens → high impact
#   Historical reports   count of past reports  high cnt  → high risk
#
# Weights are loaded from Firestore (risk_config/current) when available,
# and fall back to DEFAULT_WEIGHTS defined in gemini.py.
# This lets the Gemini pipeline dynamically amplify scores during rain alerts.

from __future__ import annotations
import math

# ---------------------------------------------------------------------------
# Static lookup tables
# ---------------------------------------------------------------------------

# Drainage status → base risk contribution (0–1)
_DRAINAGE_RISK = {
    "good": 0.0,
    "partial": 0.5,
    "blocked": 1.0,
}

# Elevation bins → base risk contribution (0–1)
# Indian coastal / low-lying cities: anything below 10 m is high risk
_ELEVATION_BINS = [
    (0, 3, 1.0),      # 0–3 m:   critical (near sea level)
    (3, 7, 0.8),      # 3–7 m:   very high
    (7, 12, 0.55),    # 7–12 m:  high
    (12, 20, 0.3),    # 12–20 m: moderate
    (20, 50, 0.1),    # 20–50 m: low
    (50, 9999, 0.0),  # >50 m:   negligible
]

# Population density bins → impact multiplier (1.0–1.5)
_DENSITY_MULTIPLIERS = [
    (0, 5_000, 1.0),
    (5_000, 15_000, 1.1),
    (15_000, 30_000, 1.2),
    (30_000, 50_000, 1.35),
    (50_000, 9_999_999, 1.5),
]

# Historical reports → recurrence score (0–1), capped at 20 reports
_MAX_HISTORICAL_REPORTS = 20


# ---------------------------------------------------------------------------
# Factor calculators
# ---------------------------------------------------------------------------

def _elevation_score(elevation_m: float) -> float:
    """Returns 0–1: higher = riskier (lower elevation)."""
    for lo, hi, score in _ELEVATION_BINS:
        if lo <= elevation_m < hi:
            return score
    return 0.0


def _drainage_score(drainage_status: str) -> float:
    """Returns 0–1 based on drain condition."""
    return _DRAINAGE_RISK.get(drainage_status.lower(), 0.5)


def _density_multiplier(population_density: float) -> float:
    """Returns 1.0–1.5: higher population = higher impact weight."""
    for lo, hi, mult in _DENSITY_MULTIPLIERS:
        if lo <= population_density < hi:
            return mult
    return 1.5


def _historical_score(historical_reports: int) -> float:
    """
    Returns 0–1.  Uses a square-root curve so the first few reports
    carry more signal than report #18 vs #19.
    """
    capped = min(historical_reports, _MAX_HISTORICAL_REPORTS)
    return math.sqrt(capped / _MAX_HISTORICAL_REPORTS)


# ---------------------------------------------------------------------------
# Main scoring function
# ---------------------------------------------------------------------------

def compute_risk_score(
    elevation_m: float,
    drainage_status: str,
    population_density: float,
    historical_reports: int,
    weights: dict | None = None,
) -> float:
    """
    Compute a Waterlogging Risk Score in [0, 100].

    Args:
        elevation_m:        Street elevation in metres.
        drainage_status:    'good' | 'partial' | 'blocked'
        population_density: Persons per km² in the street's locality.
        historical_reports: Count of confirmed waterlogging reports.
        weights:            Optional weight overrides from Gemini pipeline.
                            Keys: elevation_weight, drainage_weight,
                                  density_weight, historical_weight,
                                  rainfall_multiplier.
                            Defaults to 1.0 for each if not provided.

    Returns:
        float in [0.0, 100.0]
    """
    if weights is None:
        weights = {}

    # Extract weights with defaults
    w_elev = float(weights.get("elevation_weight", 1.0))
    w_drain = float(weights.get("drainage_weight", 1.0))
    w_density = float(weights.get("density_weight", 1.0))
    w_hist = float(weights.get("historical_weight", 1.0))
    w_rain = float(weights.get("rainfall_multiplier", 1.0))

    # --- Raw factor scores (each 0–1) ---
    elev_score = _elevation_score(elevation_m)
    drain_score = _drainage_score(drainage_status)
    hist_score = _historical_score(historical_reports)

    # --- Population density acts as a multiplicative impact amplifier ---
    density_mult = _density_multiplier(population_density)

    # --- Weighted sum (before density and rainfall scaling) ---
    # Weights for the three additive factors; they sum to 1 when all = 1.0
    # Elevation: 40%, Drainage: 40%, Historical: 20% (baseline)
    raw_sum = (
        (elev_score * w_elev * 0.40)
        + (drain_score * w_drain * 0.40)
        + (hist_score * w_hist * 0.20)
    )

    # Normalise raw_sum back to [0, 1] considering weight amplification.
    # Max possible raw_sum when all weights = 1.0 is 1.0 (by construction).
    # When weights > 1.0, raw_sum can exceed 1.0 → clamp after rainfall.
    weighted_score = raw_sum * density_mult * w_density

    # --- Apply rainfall multiplier (from Gemini weather alert pipeline) ---
    final_score = weighted_score * w_rain

    # Scale to [0, 100] and clamp
    return round(min(100.0, final_score * 100), 2)


# ---------------------------------------------------------------------------
# Batch re-scoring utility
# ---------------------------------------------------------------------------

def recompute_all_scores(db, weights: dict | None = None) -> list[dict]:
    """
    Re-score every street in Firestore using the provided weights.
    Useful after the Gemini pipeline updates risk_config/current.

    Args:
        db:      Firestore client.
        weights: Weight dict (from Gemini). Loaded from Firestore if None.

    Returns:
        List of dicts: [{"id": ..., "old_score": ..., "new_score": ...}, ...]
    """
    if weights is None:
        # Load from Firestore
        config_doc = db.collection("risk_config").document("current").get()
        weights = config_doc.to_dict() if config_doc.exists else {}

    results = []
    batch = db.batch()
    batch_size = 0

    for doc in db.collection("streets").stream():
        data = doc.to_dict()
        old_score = data.get("risk_score", 0)

        new_score = compute_risk_score(
            elevation_m=data.get("elevation_m", 10),
            drainage_status=data.get("drainage_status", "good"),
            population_density=data.get("population_density", 10_000),
            historical_reports=data.get("historical_reports", 0),
            weights=weights,
        )

        ref = db.collection("streets").document(doc.id)
        batch.update(ref, {"risk_score": new_score})
        batch_size += 1

        # Firestore batch limit is 500 writes
        if batch_size >= 490:
            batch.commit()
            batch = db.batch()
            batch_size = 0

        results.append({
            "id": doc.id,
            "name": data.get("name", ""),
            "old_score": old_score,
            "new_score": new_score,
        })

    if batch_size > 0:
        batch.commit()

    return results


# ---------------------------------------------------------------------------
# Quick self-test (run: python -m app.models.risk_scoring)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    test_cases = [
        # (elevation, drainage, density, reports, label)
        (2.0, "blocked", 55_000, 15, "Severely flood-prone"),
        (5.0, "partial", 30_000, 8, "High risk"),
        (10.0, "good", 15_000, 2, "Moderate risk"),
        (25.0, "good", 5_000, 0, "Low risk"),
        (60.0, "good", 2_000, 0, "Negligible risk"),
    ]

    print(f"{'Label':<30} {'Score':>6}")
    print("-" * 38)
    for elev, drain, density, reports, label in test_cases:
        score = compute_risk_score(elev, drain, density, reports)
        print(f"{label:<30} {score:>6.1f}")

    # Test with red-alert weights
    red_weights = {
        "elevation_weight": 1.8,
        "drainage_weight": 1.6,
        "density_weight": 1.2,
        "historical_weight": 1.3,
        "rainfall_multiplier": 2.5,
    }
    print("\n--- With Red Alert weights ---")
    for elev, drain, density, reports, label in test_cases:
        score = compute_risk_score(elev, drain, density, reports, weights=red_weights)
        print(f"{label:<30} {score:>6.1f}")
