from flask import Blueprint, jsonify, request

streets_bp = Blueprint('streets', __name__)

@streets_bp.route('', methods=['GET'])
def get_streets():
    # Return mock data for all streets with risk score
    return jsonify([
        {"id": "street_1", "name": "Park Street", "risk_score": 85, "waterlogged": True},
        {"id": "street_2", "name": "Camac Street", "risk_score": 45, "waterlogged": False}
    ])

@streets_bp.route('/<street_id>', methods=['GET'])
def get_street_by_id(street_id):
    # Single street details
    return jsonify({"id": street_id, "name": "Park Street", "risk_score": 85, "coords": [22.553, 88.352]})

@streets_bp.route('/<street_id>/risk-score', methods=['PATCH'])
def update_risk_score(street_id):
    data = request.json
    # Update logic here
    return jsonify({"message": f"Updated score for {street_id} to {data.get('score')"}), 200

@streets_bp.route('/heatmap', methods=['GET'])
def get_heatmap():
    # GeoJSON format for maps
    return jsonify({"type": "FeatureCollection", "features": []})
