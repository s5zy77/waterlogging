from flask import Blueprint, jsonify

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/me', methods=['GET'])
def current_user():
    return jsonify({"uid": "mock_user", "role": "citizen"})
