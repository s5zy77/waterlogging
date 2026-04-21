from flask import Blueprint, jsonify, request

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('', methods=['POST'])
def create_report():
    data = request.json
    return jsonify({"id": "new_report_1", "status": "pending"}), 201

@reports_bp.route('', methods=['GET'])
def get_reports():
    return jsonify([{"id": "report_1", "status": "pending", "severity": "high"}])

@reports_bp.route('/<report_id>', methods=['GET'])
def get_report(report_id):
    return jsonify({"id": report_id, "status": "pending", "image_url": "mock_url"})

@reports_bp.route('/<report_id>/status', methods=['PATCH'])
def update_report_status(report_id):
    return jsonify({"message": "Status updated"})

@reports_bp.route('/analyze', methods=['POST'])
def analyze_report():
    return jsonify({"severity": "high", "label": "Severe Waterlogging"})
