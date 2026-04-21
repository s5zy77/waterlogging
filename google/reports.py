# backend/app/routes/reports.py
# Flask blueprint: citizen waterlogging reports.
# Flow: citizen uploads image → Firebase Storage (frontend) →
#       POST /api/reports with Storage URL →
#       optionally trigger Vertex AI Vision via POST /api/reports/analyze

from flask import Blueprint, request, jsonify
from app.utils.firestore_client import get_db
from app.services.gcp.vision import analyze_waterlogging_image
from google.cloud.firestore_v1 import SERVER_TIMESTAMP, ArrayUnion

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _doc_to_dict(doc):
    data = doc.to_dict()
    data["id"] = doc.id
    return data


# ---------------------------------------------------------------------------
# POST /api/reports
# Citizen submits a waterlogging report.
# Body JSON:
# {
#   "street_id": "abc123",
#   "image_url": "https://storage.googleapis.com/...",
#   "lat": 22.5726,
#   "lng": 88.3639,
#   "description": "Water up to knee level near the crossing",
#   "reporter_uid": "firebase-uid-xyz"   # from Firebase Auth token
# }
# After saving, we automatically trigger Vision AI analysis.
# ---------------------------------------------------------------------------
@reports_bp.route("", methods=["POST"])
def create_report():
    db = get_db()
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "JSON body required"}), 400

    required = ["street_id", "image_url", "lat", "lng"]
    missing = [f for f in required if f not in body]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    # --- 1. Save the report to Firestore ---
    report_data = {
        "street_id": body["street_id"],
        "image_url": body["image_url"],
        "lat": body["lat"],
        "lng": body["lng"],
        "description": body.get("description", ""),
        "reporter_uid": body.get("reporter_uid", "anonymous"),
        "status": "pending",             # pending | verified | dismissed
        "vision_analysis": None,         # filled in after AI call
        "severity": None,                # low | medium | high | critical
        "created_at": SERVER_TIMESTAMP,
    }

    doc_ref = db.collection("reports").add(report_data)
    report_id = doc_ref[1].id

    # --- 2. Auto-trigger Vision AI analysis ---
    try:
        analysis = analyze_waterlogging_image(body["image_url"])

        # Update the report document with the AI result
        db.collection("reports").document(report_id).update({
            "vision_analysis": analysis,
            "severity": analysis.get("severity", "unknown"),
            "status": "verified" if analysis.get("is_waterlogged") else "pending",
        })

        # --- 3. Bump historical_reports count on the street ---
        if analysis.get("is_waterlogged"):
            db.collection("streets").document(body["street_id"]).update({
                "historical_reports": __import__("google.cloud.firestore_v1", fromlist=["Increment"]).Increment(1),
            })

    except Exception as e:
        # Vision failure must not block the report from being saved
        print(f"[Vision AI] Analysis failed for report {report_id}: {e}")
        analysis = {"error": str(e)}

    return jsonify({
        "id": report_id,
        "status": report_data["status"],
        "vision_analysis": analysis,
    }), 201


# ---------------------------------------------------------------------------
# GET /api/reports
# List reports. Optional filters: ?street_id=abc&status=pending
# ---------------------------------------------------------------------------
@reports_bp.route("", methods=["GET"])
def list_reports():
    db = get_db()
    ref = db.collection("reports")

    street_id = request.args.get("street_id")
    status = request.args.get("status")

    if street_id:
        ref = ref.where("street_id", "==", street_id)
    if status:
        ref = ref.where("status", "==", status)

    docs = ref.order_by("created_at", direction="DESCENDING").limit(100).stream()
    reports = [_doc_to_dict(d) for d in docs]
    return jsonify({"reports": reports, "count": len(reports)}), 200


# ---------------------------------------------------------------------------
# GET /api/reports/<report_id>
# Full detail for a single report including Vision AI result.
# ---------------------------------------------------------------------------
@reports_bp.route("/<report_id>", methods=["GET"])
def get_report(report_id):
    db = get_db()
    doc = db.collection("reports").document(report_id).get()
    if not doc.exists:
        return jsonify({"error": "Report not found"}), 404
    return jsonify(_doc_to_dict(doc)), 200


# ---------------------------------------------------------------------------
# PATCH /api/reports/<report_id>/status
# Official marks report as verified or dismissed.
# Body: { "status": "verified" | "dismissed", "official_uid": "..." }
# If verified, increments the street's historical_reports counter.
# ---------------------------------------------------------------------------
@reports_bp.route("/<report_id>/status", methods=["PATCH"])
def update_status(report_id):
    db = get_db()
    body = request.get_json(silent=True)

    allowed_statuses = {"verified", "dismissed", "pending"}
    new_status = body.get("status") if body else None

    if new_status not in allowed_statuses:
        return jsonify({"error": f"status must be one of {allowed_statuses}"}), 400

    ref = db.collection("reports").document(report_id)
    doc = ref.get()
    if not doc.exists:
        return jsonify({"error": "Report not found"}), 404

    ref.update({
        "status": new_status,
        "reviewed_by": body.get("official_uid", "unknown"),
        "reviewed_at": SERVER_TIMESTAMP,
    })

    return jsonify({"id": report_id, "status": new_status}), 200


# ---------------------------------------------------------------------------
# POST /api/reports/analyze
# Manually trigger Vision AI on an existing report's image.
# Useful for re-analysis or rate-limited retries.
# Body: { "report_id": "abc", "image_url": "https://..." }
# ---------------------------------------------------------------------------
@reports_bp.route("/analyze", methods=["POST"])
def analyze_report():
    db = get_db()
    body = request.get_json(silent=True)

    if not body or "image_url" not in body:
        return jsonify({"error": "image_url required"}), 400

    try:
        analysis = analyze_waterlogging_image(body["image_url"])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Optionally persist the result if report_id is provided
    report_id = body.get("report_id")
    if report_id:
        ref = db.collection("reports").document(report_id)
        if ref.get().exists:
            ref.update({
                "vision_analysis": analysis,
                "severity": analysis.get("severity", "unknown"),
            })

    return jsonify({"report_id": report_id, "analysis": analysis}), 200
