# backend/main.py
# Flask application entry point.
# Run: python main.py  (dev)  or  gunicorn main:app  (prod)

from flask import Flask
from flask_cors import CORS

from app.routes.streets import streets_bp
from app.routes.reports import reports_bp
from app.routes.priority import priority_bp


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)  # Allow requests from the React frontend (localhost:3000)

    # Register all route blueprints
    app.register_blueprint(streets_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(priority_bp)

    @app.route("/health")
    def health():
        return {"status": "ok", "service": "flood-ready-streets-api"}, 200

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
