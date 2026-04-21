from flask import Blueprint, jsonify, request

priority_bp = Blueprint('priority', __name__)

@priority_bp.route('', methods=['GET'])
def get_priority():
    n = request.args.get('n', 10)
    return jsonify({"priority_streets": []})

@priority_bp.route('/recommend', methods=['POST'])
def recommend_priority():
    return jsonify({"message": "Triggered Gemini recommendation update"})

@priority_bp.route('/allocations', methods=['GET'])
def get_allocations():
    return jsonify([])

@priority_bp.route('/allocations', methods=['POST'])
def create_allocation():
    return jsonify({"message": "Allocation created"}), 201

@priority_bp.route('/allocations/<allocation_id>', methods=['DELETE'])
def delete_allocation(allocation_id):
    return jsonify({"message": "Allocation removed"})
