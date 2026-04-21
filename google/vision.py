# backend/app/services/gcp/vision.py
# Vertex AI Vision wrapper.
# Sends a citizen-uploaded image URL to the Gemini Vision model
# (via the Vertex AI multimodal endpoint) and extracts:
#   - is_waterlogged (bool)
#   - severity        (low | medium | high | critical)
#   - detected_labels (list of strings)
#   - confidence      (0.0 – 1.0)
#   - raw_description (free-text model summary)
#
# Why Gemini Vision instead of AutoML?
#   For a hackathon demo, a zero-shot Gemini prompt on an image
#   is faster to ship than a fine-tuned AutoML model while still
#   leveraging Vertex AI infrastructure.

import os
import json
import re
import vertexai
from vertexai.generative_models import GenerativeModel, Part, Image

# ---------------------------------------------------------------------------
# Initialise Vertex AI once at import time.
# PROJECT_ID and LOCATION come from environment variables.
# ---------------------------------------------------------------------------
_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "your-gcp-project-id")
_LOCATION = os.getenv("GCP_LOCATION", "us-central1")

vertexai.init(project=_PROJECT_ID, location=_LOCATION)

# Use gemini-1.5-flash — fast, cheap, multimodal, available on Vertex AI.
_MODEL_NAME = "gemini-1.5-flash"

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = """
You are an urban flood-assessment AI helping Indian municipal authorities.
Analyse the provided image and respond ONLY with a valid JSON object — 
no markdown fences, no explanation — using exactly this schema:

{
  "is_waterlogged": <true | false>,
  "severity": "<low | medium | high | critical>",
  "detected_labels": ["<label1>", "<label2>"],
  "confidence": <float 0.0-1.0>,
  "drain_blocked": <true | false>,
  "road_passable": <true | false>,
  "raw_description": "<one-sentence summary>"
}

Severity guide:
  low      – minor puddles, no traffic disruption
  medium   – water on road surface, slow traffic
  high     – knee-deep water, vehicles stalling
  critical – waist-deep or more, risk to life

detected_labels should include relevant visual cues observed:
e.g. "waterlogging", "blocked drain", "submerged vehicle",
     "overflow", "debris", "low-lying area".
"""


# ---------------------------------------------------------------------------
# Public function
# ---------------------------------------------------------------------------

def analyze_waterlogging_image(image_url: str) -> dict:
    """
    Send an image (by public URL or GCS URI) to Gemini Vision on Vertex AI.

    Args:
        image_url: A publicly accessible HTTPS URL or a gs:// URI pointing
                   to the image in Firebase / GCS Storage.

    Returns:
        dict with keys: is_waterlogged, severity, detected_labels,
                        confidence, drain_blocked, road_passable,
                        raw_description.

    Raises:
        ValueError: if the model returns unparseable output.
        Exception:  propagates Vertex AI SDK errors to the caller.
    """
    model = GenerativeModel(_MODEL_NAME)

    # Build the image Part from URL.
    # For gs:// URIs the SDK streams from GCS; for https:// it fetches inline.
    if image_url.startswith("gs://"):
        image_part = Part.from_uri(image_url, mime_type="image/jpeg")
    else:
        # Download via URL — Vertex SDK handles this transparently
        image_part = Part.from_uri(image_url, mime_type="image/jpeg")

    response = model.generate_content(
        [_SYSTEM_PROMPT, image_part],
        generation_config={
            "temperature": 0.1,      # low temperature → deterministic JSON
            "max_output_tokens": 512,
        },
    )

    raw_text = response.text.strip()

    # Parse the JSON response
    try:
        result = _parse_json_response(raw_text)
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError(
            f"Vision model returned non-JSON output: {raw_text[:200]}"
        ) from exc

    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_json_response(text: str) -> dict:
    """
    Robustly parse JSON from model output.
    Strips accidental markdown fences if the model adds them.
    """
    # Strip ```json ... ``` fences if present
    clean = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    clean = re.sub(r"\s*```$", "", clean).strip()

    data = json.loads(clean)

    # Validate required keys and coerce types
    required_keys = {
        "is_waterlogged", "severity", "detected_labels",
        "confidence", "raw_description",
    }
    missing = required_keys - set(data.keys())
    if missing:
        raise ValueError(f"Model JSON missing keys: {missing}")

    # Coerce and clamp confidence
    data["confidence"] = max(0.0, min(1.0, float(data.get("confidence", 0.5))))

    # Default optional keys
    data.setdefault("drain_blocked", False)
    data.setdefault("road_passable", not data["is_waterlogged"])

    return data


# ---------------------------------------------------------------------------
# Mock fallback (for local dev without GCP credentials)
# ---------------------------------------------------------------------------

def analyze_waterlogging_image_mock(image_url: str) -> dict:
    """
    Returns a hardcoded mock response.
    Useful for local development / CI without GCP credentials.
    Swap into routes by setting env var USE_MOCK_VISION=true.
    """
    return {
        "is_waterlogged": True,
        "severity": "high",
        "detected_labels": ["waterlogging", "blocked drain", "submerged road"],
        "confidence": 0.91,
        "drain_blocked": True,
        "road_passable": False,
        "raw_description": "Severe waterlogging visible on the road surface with blocked drain.",
    }


def get_vision_analyzer():
    """
    Factory: returns real or mock analyzer based on env var.
    Usage in routes: from app.services.gcp.vision import get_vision_analyzer
                     analyze = get_vision_analyzer()
                     result  = analyze(image_url)
    """
    use_mock = os.getenv("USE_MOCK_VISION", "false").lower() == "true"
    return analyze_waterlogging_image_mock if use_mock else analyze_waterlogging_image
