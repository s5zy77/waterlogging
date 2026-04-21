# backend/app/routes/priority.py
# Flask blueprint: AI-recommended priority streets + resource allocation.
# This is the key endpoint the official dashboard calls.

from flask import Blueprint, request, jsonify
from app.utils.firestore_client import get_db
from app.models.allocation_engine import ResourceBudget, allocate_from_firestore
from app.services.gcp.gemini import get_gemini_pipeline
from app.models.risk_scoring import recompute_all_scores
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

priority_bp = Blueprint("priority", __name__, url_prefix="/api/priority")


# ---------------------------------------------------------------------------
# GET /api/priority?n=10&pumps=5&trucks=10&worker_days=20
# Returns top-N streets with recommended resource allocations.
# ---------------------------------------------------------------------------
@priority_bp.route("", methods=["GET"])
def get_priority():
    db = get_db()

    # Parse resource budget from query params (with defaults)
    top_n = int(request.args.get("n", 10))
    pumps = int(request.args.get("pumps", 5))
    trucks = int(request.args.get("trucks", 10))
    worker_days = int(request.args.get("worker_days", 20))

    budget = ResourceBudget(pumps=pumps, trucks=trucks, worker_days=worker_days)
    result = allocate_from_firestore(db, budget=budget, top_n=top_n)

    return jsonify(result), 200


# ---------------------------------------------------------------------------
# POST /api/priority/recommend
# Ingest a weather alert text, run Gemini to get new weights,
# re-score all streets, and return updated allocations.
# Body: { "alert_text": "Red alert: 220mm rainfall expected...",
#         "pumps": 5, "trucks": 10, "worker_days": 20 }
# ---------------------------------------------------------------------------
@priority_bp.route("/recommend", methods=["POST"])
def recommend():
    db = get_db()
    body = request.get_json(silent=True)

    if not body or "alert_text" not in body:
        return jsonify({"error": "alert_text required"}), 400

    # Run Gemini pipeline → parse weather + compute weights → save to Firestore
    pipeline = get_gemini_pipeline()
    gemini_result = pipeline(body["alert_text"], db=db)

    # Re-score all streets with the new weights
    weights = gemini_result["weights"]
    score_changes = recompute_all_scores(db, weights=weights)

    # Run allocation with updated scores
    budget = ResourceBudget(
        pumps=int(body.get("pumps", 5)),
        trucks=int(body.get("trucks", 10)),
        worker_days=int(body.get("worker_days", 20)),
    )
    allocation = allocate_from_firestore(db, budget=budget)

    return jsonify({
        "weather_parsed": gemini_result["weather"],
        "weights_applied": weights,
        "streets_rescored": len(score_changes),
        "allocation": allocation,
    }), 200


# ---------------------------------------------------------------------------
# GET /api/priority/allocations
# Current persisted resource assignments (from Firestore collection).
# ---------------------------------------------------------------------------
@priority_bp.route("/allocations", methods=["GET"])
def list_allocations():
    db = get_db()
    docs = db.collection("allocations").order_by("created_at", direction="DESCENDING").limit(50).stream()
    allocs = [{"id": d.id, **d.to_dict()} for d in docs]
    return jsonify({"allocations": allocs}), 200


# ---------------------------------------------------------------------------
# POST /api/priority/allocations
# Official confirms and persists a resource assignment.
# Body: { "street_id": "...", "resource_type": "pump|truck|workers",
#         "quantity": 1, "assigned_by": "official-uid" }
# ---------------------------------------------------------------------------
@priority_bp.route("/allocations", methods=["POST"])
def create_allocation():
    db = get_db()
    body = request.get_json(silent=True)

    required = ["street_id", "resource_type"]
    if not body or any(f not in body for f in required):
        return jsonify({"error": f"Required: {required}"}), 400

    data = {
        "street_id": body["street_id"],
        "resource_type": body["resource_type"],
        "quantity": body.get("quantity", 1),
        "assigned_by": body.get("assigned_by", "unknown"),
        "status": "active",
        "created_at": SERVER_TIMESTAMP,
    }
    ref = db.collection("allocations").add(data)
    return jsonify({"id": ref[1].id}), 201


# ---------------------------------------------------------------------------
# DELETE /api/priority/allocations/<allocation_id>
# Mark allocation as completed (resource returned).
# ---------------------------------------------------------------------------
@priority_bp.route("/allocations/<allocation_id>", methods=["DELETE"])
def delete_allocation(allocation_id):
    db = get_db()
    ref = db.collection("allocations").document(allocation_id)
    if not ref.get().exists:
        return jsonify({"error": "Allocation not found"}), 404
    ref.update({"status": "completed", "completed_at": SERVER_TIMESTAMP})
    return jsonify({"message": "Allocation marked completed"}), 200
