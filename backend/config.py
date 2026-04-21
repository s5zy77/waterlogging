import os

class Config:
    USE_MOCK_VISION = os.getenv("USE_MOCK_VISION", "true").lower() == "true"
    USE_MOCK_GEMINI = os.getenv("USE_MOCK_GEMINI", "true").lower() == "true"
    GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "local-dev")
    GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")
