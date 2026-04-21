#!/usr/bin/env python3
# data/seed_firestore.py
# Populate Firestore with mock Kolkata street segments for demo.
# Run once before the demo: python data/seed_firestore.py
#
# Prerequisites:
#   pip install firebase-admin --break-system-packages
#   export GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json

import firebase_admin
from firebase_admin import credentials, firestore
import os, sys

# Initialise
cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if not cred_path:
    print("ERROR: Set GOOGLE_APPLICATION_CREDENTIALS env var first.")
    sys.exit(1)

firebase_admin.initialize_app(credentials.Certificate(cred_path))
db = firestore.client()

# ── Mock Kolkata street data ────────────────────────────────────────────────
# Fields match the Firestore schema exactly.
# elevation_m: Kolkata is very low-lying (0–12 m); southern parts near sea level.
# drainage_status: "good" | "partial" | "blocked"
# population_density: persons/km² (Kolkata avg ~24,000; dense wards > 50,000)

STREETS = [
    {
        "name": "Rashbehari Avenue",
        "zone": "south", "lat": 22.5182, "lng": 88.3490,
        "elevation_m": 3.5, "drainage_status": "blocked",
        "population_density": 55000, "historical_reports": 18,
    },
    {
        "name": "Park Street",
        "zone": "central", "lat": 22.5521, "lng": 88.3510,
        "elevation_m": 5.2, "drainage_status": "partial",
        "population_density": 38000, "historical_reports": 11,
    },
    {
        "name": "Ballygunge Circular Road",
        "zone": "south", "lat": 22.5229, "lng": 88.3610,
        "elevation_m": 4.8, "drainage_status": "partial",
        "population_density": 29000, "historical_reports": 7,
    },
    {
        "name": "AJC Bose Road",
        "zone": "central", "lat": 22.5395, "lng": 88.3467,
        "elevation_m": 6.0, "drainage_status": "partial",
        "population_density": 41000, "historical_reports": 9,
    },
    {
        "name": "VIP Road (Jessore Road)",
        "zone": "north", "lat": 22.6223, "lng": 88.4062,
        "elevation_m": 8.1, "drainage_status": "good",
        "population_density": 21000, "historical_reports": 4,
    },
    {
        "name": "Gariahat Road",
        "zone": "south", "lat": 22.5093, "lng": 88.3640,
        "elevation_m": 3.0, "drainage_status": "blocked",
        "population_density": 48000, "historical_reports": 15,
    },
    {
        "name": "Salt Lake Sector V",
        "zone": "east", "lat": 22.5762, "lng": 88.4298,
        "elevation_m": 7.5, "drainage_status": "good",
        "population_density": 13000, "historical_reports": 2,
    },
    {
        "name": "Ultadanga Main Road",
        "zone": "north", "lat": 22.5872, "lng": 88.3948,
        "elevation_m": 5.8, "drainage_status": "partial",
        "population_density": 33000, "historical_reports": 8,
    },
    {
        "name": "Eastern Metropolitan Bypass",
        "zone": "east", "lat": 22.5354, "lng": 88.3981,
        "elevation_m": 9.2, "drainage_status": "good",
        "population_density": 18000, "historical_reports": 3,
    },
    {
        "name": "Naktala Road",
        "zone": "south", "lat": 22.4895, "lng": 88.3730,
        "elevation_m": 2.1, "drainage_status": "blocked",
        "population_density": 52000, "historical_reports": 20,
    },
    {
        "name": "Dum Dum Road",
        "zone": "north", "lat": 22.6401, "lng": 88.3990,
        "elevation_m": 6.4, "drainage_status": "partial",
        "population_density": 27000, "historical_reports": 5,
    },
    {
        "name": "Tollygunge Circular Road",
        "zone": "south", "lat": 22.4990, "lng": 88.3499,
        "elevation_m": 3.8, "drainage_status": "blocked",
        "population_density": 46000, "historical_reports": 14,
    },
]

def compute_risk_score(s):
    """Simplified inline score for seeding (mirrors risk_scoring.py logic)."""
    import math
    elev_map = [(0,3,1.0),(3,7,0.8),(7,12,0.55),(12,20,0.3),(20,50,0.1)]
    drain_map = {"good":0.0,"partial":0.5,"blocked":1.0}
    density_mult = 1.0 + min(s["population_density"] / 100000, 0.5)
    elev_score = next((sc for lo,hi,sc in elev_map if lo<=s["elevation_m"]<hi), 0.1)
    drain_score = drain_map.get(s["drainage_status"], 0.5)
    hist_score = math.sqrt(min(s["historical_reports"], 20) / 20)
    raw = elev_score*0.40 + drain_score*0.40 + hist_score*0.20
    return round(min(100.0, raw * density_mult * 100), 1)

def seed():
    batch = db.batch()
    streets_ref = db.collection("streets")

    for s in STREETS:
        score = compute_risk_score(s)
        doc_ref = streets_ref.document()
        batch.set(doc_ref, {
            **s,
            "risk_score": score,
            "score_history": [{"score": score, "reason": "seed", "updated_at": firestore.SERVER_TIMESTAMP}],
            "resources_assigned": [],
            "created_at": firestore.SERVER_TIMESTAMP,
        })
        print(f"  Queued: {s['name']:<35}  score={score}")

    # Default risk config (no active weather alert)
    config_ref = db.collection("risk_config").document("current")
    batch.set(config_ref, {
        "alert_level": "none",
        "rainfall_mm_24h": 0,
        "elevation_weight": 1.0,
        "drainage_weight": 1.0,
        "density_weight": 1.0,
        "historical_weight": 1.0,
        "rainfall_multiplier": 1.0,
        "source_alert": "seed",
        "updated_at": firestore.SERVER_TIMESTAMP,
    })

    batch.commit()
    print(f"\nSeeded {len(STREETS)} streets + risk_config/current.")

if __name__ == "__main__":
    print("Seeding Firestore...")
    seed()
