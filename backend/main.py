import os
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Initialize Firebase Admin if credential path exists, else mock
import firebase_admin
from firebase_admin import credentials, firestore

try:
    cred = credentials.Certificate(os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccount.json"))
    firebase_admin.initialize_app(cred)
except Exception as e:
    print("Warning: Firebase not initialized properly. Local mock mode?")

from app.routes.streets import streets_bp
from app.routes.reports import reports_bp
from app.routes.priority import priority_bp
from app.routes.auth import auth_bp

app = Flask(__name__)
CORS(app)

# Register Blueprints
app.register_blueprint(streets_bp, url_prefix='/api/streets')
app.register_blueprint(reports_bp, url_prefix='/api/reports')
app.register_blueprint(priority_bp, url_prefix='/api/priority')
app.register_blueprint(auth_bp, url_prefix='/api/auth')

@app.route('/')
def index():
    return jsonify({"message": "Flood-Ready Streets API running"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
