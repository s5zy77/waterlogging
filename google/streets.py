# backend/app/routes/streets.py
# Flask blueprint: CRUD for street segments + waterlogging risk scores.
# All data lives in Firestore collection "streets".

from flask import Blueprint, request, jsonify
from app.utils.firestore_client import get_db
from app.models.risk_scoring import compute_risk_score
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

streets_bp = Blueprint("streets", __name__, url_prefix="/api/streets")

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _street_doc_to_dict(doc):
    """Convert a Firestore DocumentSnapshot → plain dict with 'id' included."""
    data = doc.to_dict()
    data["id"] = doc.id
    return data


# ---------------------------------------------------------------------------
# GET /api/streets
# Returns all street segments with their current risk scores.
# Optional query param: ?zone=north  to filter by city zone.
# ---------------------------------------------------------------------------
@streets_bp.route("", methods=["GET"])
def list_streets():
    db = get_db()
    zone = request.args.get("zone")          # optional filter

    ref = db.collection("streets")
    if zone:
        ref = ref.where("zone", "==", zone)

    docs = ref.stream()
    streets = [_street_doc_to_dict(d) for d in docs]
    return jsonify({"streets": streets, "count": len(streets)}), 200


# ---------------------------------------------------------------------------
# GET /api/streets/heatmap
# Returns a lightweight GeoJSON FeatureCollection for the heatmap layer.
# Only includes: street_id, lat, lng, risk_score.
# ---------------------------------------------------------------------------
@streets_bp.route("/heatmap", methods=["GET"])
def heatmap():
    db = get_db()
    docs = db.collection("streets").stream()

    features = []
    for doc in docs:
        d = doc.to_dict()
        # Each feature is a GeoJSON Point with risk_score as a property
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [d.get("lng", 0), d.get("lat", 0)],
            },
            "properties": {
                "street_id": doc.id,
                "name": d.get("name", ""),
                "risk_score": d.get("risk_score", 0),
                "zone": d.get("zone", ""),
            },
        }
        features.append(feature)

    geojson = {"type": "FeatureCollection", "features": features}
    return jsonify(geojson), 200


# ---------------------------------------------------------------------------
# GET /api/streets/<street_id>
# Returns a single street's full details including score history.
# ---------------------------------------------------------------------------
@streets_bp.route("/<street_id>", methods=["GET"])
def get_street(street_id):
    db = get_db()
    doc = db.collection("streets").document(street_id).get()

    if not doc.exists:
        return jsonify({"error": "Street not found"}), 404

    return jsonify(_street_doc_to_dict(doc)), 200


# ---------------------------------------------------------------------------
# POST /api/streets
# Create a new street segment (admin / seeding use).
# Body JSON example:
# {
#   "name": "Rashbehari Avenue",
#   "lat": 22.5355, "lng": 88.3534,
#   "zone": "south",
#   "elevation_m": 6.2,
#   "drainage_status": "partial",   # good | partial | blocked
#   "population_density": 42000,
#   "historical_reports": 8
# }
# ---------------------------------------------------------------------------
@streets_bp.route("", methods=["POST"])
def create_street():
    db = get_db()
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400

    required = ["name", "lat", "lng", "zone"]
    missing = [f for f in required if f not in body]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    # Compute initial risk score from provided attributes
    risk_score = compute_risk_score(
        elevation_m=body.get("elevation_m", 10),
        drainage_status=body.get("drainage_status", "good"),
        population_density=body.get("population_density", 10000),
        historical_reports=body.get("historical_reports", 0),
    )

    street_data = {
        "name": body["name"],
        "lat": body["lat"],
        "lng": body["lng"],
        "zone": body["zone"],
        "elevation_m": body.get("elevation_m", 10),
        "drainage_status": body.get("drainage_status", "good"),
        "population_density": body.get("population_density", 10000),
        "historical_reports": body.get("historical_reports", 0),
        "risk_score": risk_score,
        "score_history": [{"score": risk_score, "updated_at": SERVER_TIMESTAMP}],
        "resources_assigned": [],
        "created_at": SERVER_TIMESTAMP,
    }

    doc_ref = db.collection("streets").add(street_data)
    # doc_ref is a tuple (update_time, DocumentReference)
    new_id = doc_ref[1].id
    return jsonify({"id": new_id, "risk_score": risk_score}), 201


# ---------------------------------------------------------------------------
# PATCH /api/streets/<street_id>/risk-score
# Update the risk score for a street.
# Called by the AI pipeline after Vision analysis or Gemini rule update.
# Body: { "risk_score": 78.5, "reason": "Gemini weather update" }
# ---------------------------------------------------------------------------
@streets_bp.route("/<street_id>/risk-score", methods=["PATCH"])
def update_risk_score(street_id):
    db = get_db()
    body = request.get_json(silent=True)

    if not body or "risk_score" not in body:
        return jsonify({"error": "risk_score required in body"}), 400

    new_score = float(body["risk_score"])
    if not (0 <= new_score <= 100):
        return jsonify({"error": "risk_score must be 0–100"}), 400

    ref = db.collection("streets").document(street_id)
    doc = ref.get()
    if not doc.exists:
        return jsonify({"error": "Street not found"}), 404

    # Append to score_history array and update the top-level score
    from google.cloud.firestore_v1 import ArrayUnion
    ref.update({
        "risk_score": new_score,
        "score_history": ArrayUnion([{
            "score": new_score,
            "reason": body.get("reason", "manual update"),
            "updated_at": SERVER_TIMESTAMP,
        }]),
    })

    return jsonify({"id": street_id, "risk_score": new_score}), 200


# ---------------------------------------------------------------------------
# DELETE /api/streets/<street_id>
# Remove a street segment (admin only).
# ---------------------------------------------------------------------------
@streets_bp.route("/<street_id>", methods=["DELETE"])
def delete_street(street_id):
    db = get_db()
    ref = db.collection("streets").document(street_id)
    if not ref.get().exists:
        return jsonify({"error": "Street not found"}), 404

    ref.delete()
    return jsonify({"message": f"Street {street_id} deleted"}), 200
