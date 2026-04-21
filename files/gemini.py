# backend/app/services/gcp/gemini.py
# Gemini (text) service via Vertex AI.
#
# Responsibilities:
#   1. parse_weather_alert(text) → structured weather data dict
#   2. update_risk_weights(weather_data) → adjusted scoring weights
#      that the risk_scoring model will use for the next score computation
#
# Design:
#   Gemini acts as a smart rule-interpreter.  We feed it a raw IMD-style
#   weather alert (e.g. "Red alert for heavy rainfall in Kolkata, 150mm
#   expected in 24 hrs, strong westerlies") and it returns calibrated
#   multipliers for each risk factor.  These multipliers are stored in
#   Firestore under risk_config/current and read by compute_risk_score().

import os
import json
import re
import vertexai
from vertexai.generative_models import GenerativeModel

_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "your-gcp-project-id")
_LOCATION = os.getenv("GCP_LOCATION", "us-central1")

vertexai.init(project=_PROJECT_ID, location=_LOCATION)

_MODEL_NAME = "gemini-1.5-flash"

# ---------------------------------------------------------------------------
# Default risk weights (used when no Gemini update has been applied yet)
# Each weight is a multiplier: 1.0 = normal, >1 = amplified, <1 = reduced
# ---------------------------------------------------------------------------
DEFAULT_WEIGHTS = {
    "elevation_weight": 1.0,        # low elevation → higher risk
    "drainage_weight": 1.0,         # blocked drains → higher risk
    "density_weight": 1.0,          # high population density → higher impact
    "historical_weight": 1.0,       # past flooding incidents
    "rainfall_multiplier": 1.0,     # overall scale factor driven by rainfall
    "alert_level": "none",          # none | yellow | orange | red
    "rainfall_mm_24h": 0,
    "forecast_hours": 24,
}


# ---------------------------------------------------------------------------
# Prompt: parse a free-text weather alert into structured JSON
# ---------------------------------------------------------------------------
_PARSE_PROMPT = """
You are a flood-risk analyst for Indian cities.
Parse the following weather alert text and respond ONLY with a valid JSON
object — no markdown, no explanation — using exactly this schema:

{
  "alert_level": "<none | yellow | orange | red>",
  "rainfall_mm_24h": <expected rainfall in mm over next 24 hours, integer>,
  "forecast_hours": <how many hours the alert covers, integer>,
  "wind_speed_kmh": <integer or null>,
  "storm_surge_risk": <true | false>,
  "city_zones_affected": ["<zone1>", "<zone2>"],
  "summary": "<one-sentence plain-English summary>"
}

Alert level guide (IMD scale):
  none   – no alert or green
  yellow – watch; 64–115 mm/day
  orange – be prepared; 115–204 mm/day
  red    – take action; > 204 mm/day

Weather alert text:
\"\"\"
{alert_text}
\"\"\"
"""


# ---------------------------------------------------------------------------
# Prompt: given parsed weather data, return updated risk-scoring weights
# ---------------------------------------------------------------------------
_WEIGHTS_PROMPT = """
You are calibrating a Waterlogging Risk Scoring model for an Indian city.
Given the parsed weather forecast below, return updated factor weights
as a valid JSON object — no markdown, no explanation — using this schema:

{
  "elevation_weight": <float 0.5–2.0>,
  "drainage_weight": <float 0.5–2.0>,
  "density_weight": <float 0.5–2.0>,
  "historical_weight": <float 0.5–2.0>,
  "rainfall_multiplier": <float 1.0–3.0>,
  "reasoning": "<one-sentence justification>"
}

Rules:
- rainfall_multiplier = 1 + (rainfall_mm_24h / 100).  Cap at 3.0.
- Red alert → raise drainage_weight and elevation_weight to ≥ 1.5.
- Orange alert → raise drainage_weight to ≥ 1.3.
- Storm surge → raise elevation_weight to ≥ 1.8.
- No alert → keep all weights at 1.0.

Parsed weather forecast:
{weather_json}
"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_weather_alert(alert_text: str) -> dict:
    """
    Use Gemini to parse a free-text weather alert into a structured dict.

    Args:
        alert_text: Raw weather bulletin (IMD or any format).

    Returns:
        dict with keys: alert_level, rainfall_mm_24h, forecast_hours,
                        wind_speed_kmh, storm_surge_risk, city_zones_affected,
                        summary.
    """
    model = GenerativeModel(_MODEL_NAME)
    prompt = _PARSE_PROMPT.format(alert_text=alert_text)

    response = model.generate_content(
        prompt,
        generation_config={"temperature": 0.0, "max_output_tokens": 512},
    )

    return _parse_json(response.text)


def update_risk_weights(weather_data: dict) -> dict:
    """
    Use Gemini to translate parsed weather data into risk-factor multipliers.

    Args:
        weather_data: Output of parse_weather_alert().

    Returns:
        dict with keys: elevation_weight, drainage_weight, density_weight,
                        historical_weight, rainfall_multiplier, reasoning.
        Also includes original alert_level and rainfall_mm_24h for traceability.
    """
    model = GenerativeModel(_MODEL_NAME)
    weather_json = json.dumps(weather_data, indent=2)
    prompt = _WEIGHTS_PROMPT.format(weather_json=weather_json)

    response = model.generate_content(
        prompt,
        generation_config={"temperature": 0.0, "max_output_tokens": 512},
    )

    weights = _parse_json(response.text)

    # Clamp all numeric weights to safe ranges
    for key in ("elevation_weight", "drainage_weight", "density_weight", "historical_weight"):
        weights[key] = max(0.5, min(2.0, float(weights.get(key, 1.0))))
    weights["rainfall_multiplier"] = max(1.0, min(3.0, float(weights.get("rainfall_multiplier", 1.0))))

    # Carry forward metadata for the Firestore record
    weights["alert_level"] = weather_data.get("alert_level", "none")
    weights["rainfall_mm_24h"] = weather_data.get("rainfall_mm_24h", 0)

    return weights


def process_weather_alert_pipeline(alert_text: str, db=None) -> dict:
    """
    Full pipeline: parse alert → compute weights → persist to Firestore.

    Args:
        alert_text: Raw weather bulletin text.
        db:         Firestore client (from get_db()). If None, skips persist.

    Returns:
        dict with both parsed weather data and updated weights.
    """
    weather_data = parse_weather_alert(alert_text)
    weights = update_risk_weights(weather_data)

    result = {
        "weather": weather_data,
        "weights": weights,
    }

    # Persist the new weights to Firestore so risk_scoring.py picks them up
    if db is not None:
        from google.cloud.firestore_v1 import SERVER_TIMESTAMP
        db.collection("risk_config").document("current").set({
            **weights,
            "source_alert": alert_text[:500],   # store first 500 chars
            "updated_at": SERVER_TIMESTAMP,
        })

    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_json(text: str) -> dict:
    """Strip markdown fences and parse JSON from model output."""
    clean = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    clean = re.sub(r"\s*```$", "", clean).strip()
    return json.loads(clean)


# ---------------------------------------------------------------------------
# Mock (local dev without GCP credentials)
# ---------------------------------------------------------------------------

def process_weather_alert_pipeline_mock(alert_text: str, db=None) -> dict:
    """Mock pipeline for local development."""
    weather_data = {
        "alert_level": "red",
        "rainfall_mm_24h": 220,
        "forecast_hours": 24,
        "wind_speed_kmh": 60,
        "storm_surge_risk": True,
        "city_zones_affected": ["south", "central"],
        "summary": "Red alert: extremely heavy rainfall expected, storm surge risk.",
    }
    weights = {
        "elevation_weight": 1.8,
        "drainage_weight": 1.6,
        "density_weight": 1.2,
        "historical_weight": 1.3,
        "rainfall_multiplier": 2.5,
        "reasoning": "Red alert with storm surge → maximum elevation and drainage amplification.",
        "alert_level": "red",
        "rainfall_mm_24h": 220,
    }
    return {"weather": weather_data, "weights": weights}


def get_gemini_pipeline():
    """Factory for real vs mock pipeline."""
    use_mock = os.getenv("USE_MOCK_GEMINI", "false").lower() == "true"
    return process_weather_alert_pipeline_mock if use_mock else process_weather_alert_pipeline
