"""Config for the Instagram Carousel Generator (standalone kit build).

Self-contained: no dependency on any parent project. Drop the `carousel/` folder
into any project and the scripts run. Images are generated via the kie.ai API
(Nano Banana Pro) using the user's own KIE_API_KEY from a .env file.
"""
import os
from pathlib import Path

CAROUSEL_ROOT = Path(__file__).resolve().parent.parent   # .../carousel
PROJECT_ROOT = CAROUSEL_ROOT.parent                       # where the user drops .env

# Load KIE_API_KEY (and other vars) from a .env file if python-dotenv is installed.
try:
    from dotenv import load_dotenv
    for _env in (PROJECT_ROOT / ".env", CAROUSEL_ROOT / ".env"):
        if _env.exists():
            load_dotenv(_env)
            break
except Exception:
    pass  # dotenv optional; env vars still work

# --- Paths ---
ASSETS_DIR = CAROUSEL_ROOT / "assets"
KNOWLEDGE_DIR = CAROUSEL_ROOT / "knowledge"
RUNS_DIR = CAROUSEL_ROOT / "runs"
OUTPUT_DIR = CAROUSEL_ROOT / "output"
TEMPLATE = CAROUSEL_ROOT / "scripts" / "template.html"
# The single bundled style reference (swap this file to change the look — ONE only).
STYLE_REFERENCE = ASSETS_DIR / "carousel-style-reference.jpg"

# --- Output canvas: Instagram carousel 4:5 (1080x1350) ---
CANVAS_W = int(os.getenv("CAROUSEL_W", "1080"))
CANVAS_H = int(os.getenv("CAROUSEL_H", "1350"))
RENDER_SCALE = int(os.getenv("CAROUSEL_RENDER_SCALE", "2"))

# --- Background generation via kie.ai (bring your own KIE_API_KEY) ---
KIE_API_KEY = os.getenv("KIE_API_KEY", "")                 # get one at https://kie.ai/api-key
KIE_BASE_URL = os.getenv("KIE_BASE_URL", "https://api.kie.ai")
# Nano Banana Pro (Gemini 3 Pro Image) — matches the look, supports 4:5 natively.
# Swap to another kie model here if you like (e.g. "nano-banana-2", "gpt-image-2-image-to-image").
MODEL_IMAGE = os.getenv("CAROUSEL_MODEL", "nano-banana-pro")
BG_ASPECT = os.getenv("CAROUSEL_BG_ASPECT", "4:5")
BG_RESOLUTION = os.getenv("CAROUSEL_BG_RESOLUTION", "2K")   # 1K | 2K | 4K
WORKERS = int(os.getenv("CAROUSEL_WORKERS", "3"))
STYLE_REFERENCE_URL = os.getenv("CAROUSEL_STYLE_REFERENCE_URL", "")
UPLOAD_PROVIDER = os.getenv("UPLOAD_PROVIDER", "catbox")    # catbox | 0x0 (hosts the style ref for kie)

# --- Polling (kie fallback) ---
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "6"))
POLL_TIMEOUT = float(os.getenv("POLL_TIMEOUT", "900"))
