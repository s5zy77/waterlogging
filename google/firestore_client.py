# backend/app/utils/firestore_client.py
import os
import firebase_admin
from firebase_admin import credentials, firestore

_db = None

def get_db():
    """Singleton Firestore client. Initialises Firebase Admin on first call."""
    global _db
    if _db is None:
        if not firebase_admin._apps:
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if cred_path:
                cred = credentials.Certificate(cred_path)
            else:
                cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
        _db = firestore.client()
    return _db
