"""Cut the subject out of a photo (transparent PNG), free and offline, via Apple Vision.

Compiles cutout.swift on first use into scripts/.bin/cutout (needs Xcode command-line
tools and macOS 14+). The cutout is the same size as the photo, so a template can stack
    photo  ->  headline  ->  cutout
and the headline reads as sitting BEHIND the subject (Sun-Faded, Sky-Blue styles).

Usage:
    python3 cutout.py <photo> [<out.png>]          # default out: <photo>.cutout.png
    python3 cutout.py <photo> <out.png> --mask     # alpha mask only
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "cutout.swift"
BIN = HERE / ".bin" / "cutout"


def _build():
    if BIN.exists() and BIN.stat().st_mtime >= SRC.stat().st_mtime:
        return
    BIN.parent.mkdir(exist_ok=True)
    subprocess.run(["swiftc", "-O", str(SRC), "-o", str(BIN)], check=True)


def cutout(photo: str | Path, out: str | Path | None = None, mask: bool = False) -> Path:
    _build()
    photo = Path(photo)
    out = Path(out) if out else photo.with_suffix(".cutout.png")
    cmd = [str(BIN), str(photo), str(out)] + (["--mask"] if mask else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"cutout failed for {photo.name}: {r.stderr.strip()}")
    print(r.stdout.strip())
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__); raise SystemExit(1)
    m = "--mask" in a
    a = [x for x in a if x != "--mask"]
    cutout(a[0], a[1] if len(a) > 1 else None, m)
