"""Upload a local file to a public URL (kie.ai image inputs must be public URLs).

Only the local style-reference image needs this; gpt-image-2 outputs are already
public kie URLs that chain straight into the video models. Results are cached by
file content hash so the style reference is uploaded at most once.

Set STYLE_REFERENCE_URL in .env to bypass uploading entirely.
"""
import hashlib
import json
import requests

import carousel_config as config

_CACHE = config.RUNS_DIR / ".upload-cache.json"
_UA = {"User-Agent": "vox-video-pipeline/1.0"}


def _sha256(path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_cache() -> dict:
    if _CACHE.exists():
        try:
            return json.loads(_CACHE.read_text())
        except json.JSONDecodeError:
            return {}
    return {}


def _save_cache(cache: dict):
    config.RUNS_DIR.mkdir(parents=True, exist_ok=True)
    _CACHE.write_text(json.dumps(cache, indent=2))


def _upload_0x0(path) -> str:
    with open(path, "rb") as f:
        r = requests.post("https://0x0.st", headers=_UA, files={"file": f}, timeout=120)
    r.raise_for_status()
    return r.text.strip()


def _upload_catbox(path) -> str:
    with open(path, "rb") as f:
        r = requests.post(
            "https://catbox.moe/user/api.php",
            headers=_UA,
            data={"reqtype": "fileupload"},
            files={"fileToUpload": f},
            timeout=120,
        )
    r.raise_for_status()
    return r.text.strip()


def public_url(path) -> str:
    """Return a public URL for a local file, uploading + caching if needed."""
    path = str(path)
    key = _sha256(path)
    cache = _load_cache()
    if key in cache:
        return cache[key]

    provider = config.UPLOAD_PROVIDER.lower()
    uploader = _upload_catbox if provider == "catbox" else _upload_0x0
    url = uploader(path)
    if not url.startswith("http"):
        raise RuntimeError(f"Upload via {provider} returned unexpected response: {url!r}")

    cache[key] = url
    _save_cache(cache)
    print(f"  uploaded {path} -> {url}")
    return url


def style_reference_url() -> str:
    if config.STYLE_REFERENCE_URL:
        return config.STYLE_REFERENCE_URL
    if not config.STYLE_REFERENCE.exists():
        raise SystemExit(f"Style reference not found: {config.STYLE_REFERENCE}")
    return public_url(config.STYLE_REFERENCE)


if __name__ == "__main__":
    print(style_reference_url())
