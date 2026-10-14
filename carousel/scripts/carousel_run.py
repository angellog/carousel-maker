"""Orchestrator for the Instagram carousel generator.

Subcommands:
  init <slug>       create a fresh run folder + starter plan.json, print its path
  localbg <run>     paint every background LOCALLY (procedural, FREE, no API)   <-- default
  generate <run>    generate every background via kie.ai Nano Banana Pro (PAID)
  render <run>      overlay the template on each background -> 1080x1350 PNGs
  export <run>      copy final numbered slides into output/<slug>/
  build <run>       localbg + render + export   (fully offline, costs nothing)
  produce <run>     generate + render + export  (PAID background step)

APPROVAL GATE: never run `generate` / `produce` until the user has approved the
plan.json (those cost real kie.ai credits). `init` / `localbg` / `render` /
`export` / `build` are free and need no key.
"""
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import carousel_config as cfg


def _slugify(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:48] or "carousel"


# Shared style sentence so every background reads as one set (used only by the PAID
# kie.ai path — the local painter gets its look from carousel_localbg.py's scenes).
_STYLE = (
    "Midnight bioluminescent nocturnal macro photograph of a wild meadow. Pure void-black "
    "field; the ONLY light is a soft teal bioluminescent glow emitted from INSIDE the scene, "
    "low in the frame. Wild flora (queen anne's lace, dandelion clocks, grass seed heads) is "
    "silhouette with a thin teal rim light, never fully exposed. Deep shadow, heavy grain, "
    "shallow depth of field, out-of-focus black foreground stems. Edges fall off to pure "
    "black; nothing touches the frame. Keep the TOP HALF unbroken black (headline room). "
    "Cinematic, quiet, premium. No text, no letters, no logos, no UI, no panels."
)


def _slide(index, role, headline, hero_word, subtitle, scene, topic_tag="", bg_scene=None):
    return {
        "index": index,
        "role": role,                       # hook | body | cta (labels for you)
        "topic_tag": topic_tag,             # small glass chip, top-left; "" hides it
        "headline": headline,               # light serif, centered
        "hero_word": hero_word,             # THE glass capsule word; "" hides the capsule
        "subtitle": subtitle,               # glass caption pill; "" hides it
        "cta_pill": "", "cta_soft": "",     # bright frosted button, e.g. "Join waitlist" + "now"
        "microcopy": "",                    # small fog-gray line under the button
        "bg_scene": bg_scene,               # LOCAL painter scene (see carousel_localbg.SCENES)
        "image_prompt": f"{scene} {_STYLE}",   # only used by the PAID kie.ai path
        "subject_image": None,              # optional 2nd input image (path under carousel/ or URL)
        "bg_url": None, "bg_file": None, "out_file": None,
    }


def _profile() -> dict:
    """The user's saved answers (carousel/profile.json, written by the skill's intake)."""
    f = cfg.CAROUSEL_ROOT / "profile.json"
    try:
        return json.loads(f.read_text()) if f.exists() else {}
    except ValueError:
        return {}


def _starter_plan(slug: str, stamp: str) -> dict:
    """A 6-slide starter (hook -> 4 value slides -> CTA). Edit before `generate`.

    Carousel arc: slide 1 is the scroll-stopping HOOK, 2-5 deliver the value one
    idea per slide, slide 6 is the CTA. Keep it to 5-7 slides.
    """
    plan = {
        "slug": f"{stamp}-{slug}",
        "topic": "",
        "created": stamp,
        "template": "template.html",        # midnight glass (default). Alt: template-pastoral.html
        "brand_label": _profile().get("brand_label", ""),          # footer right
        "tagline": _profile().get("tagline", ""),                  # footer middle
        "handle": _profile().get("handle", "@yourhandle"),        # footer left
        "canvas": {"w": cfg.CANVAS_W, "h": cfg.CANVAS_H, "aspect": "4:5"},
        "slides": [
            _slide(1, "hook", "Built for the", "thinkers",
                   "", "A wild meadow at night, a teal glow rising from deep inside it.",
                   bg_scene="deep-bloom"),
            _slide(2, "body", "It starts with one", "reference",
                   "Drop in the look you want. The whole set locks to it.",
                   "A quiet field under stars, the light low and far away.",
                   bg_scene="far-field"),
            _slide(3, "body", "The scene is painted", "locally",
                   "No API, no credits — the background is drawn in code.",
                   "Tall out-of-focus stems in front of the glow.",
                   bg_scene="close-flora"),
            _slide(4, "body", "Every surface is", "glass",
                   "Cards, pills and frames are blurred, lit and translucent.",
                   "A single dandelion clock catching the light.",
                   bg_scene="dandelion"),
            _slide(5, "body", "Type is code, never", "AI",
                   "Headlines render crisp at 1080×1350 — never garbled.",
                   "Low mist drifting through the teal light.",
                   bg_scene="mist"),
            _slide(6, "cta", "Your turn", "",
                   "", "Warm amber florets in the foreground, the field glowing behind.",
                   bg_scene="amber-meadow"),
        ],
    }
    # the CTA slide carries the bright frosted button from the style sheet
    plan["slides"][-1].update({
        "cta_pill": "Save this", "cta_soft": "for later",
        "microcopy": f"Follow {_profile().get('handle', '@yourhandle')} for more.",
    })
    plan["slides"][0]["microcopy"] = "A carousel painted, laid out and rendered locally."
    return plan


def cmd_init(slug: str):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    slug = _slugify(slug)
    run_dir = cfg.RUNS_DIR / f"{stamp}-{slug}"
    (run_dir / "media").mkdir(parents=True, exist_ok=True)
    (run_dir / "plan.json").write_text(json.dumps(_starter_plan(slug, stamp), indent=2))
    print(str(run_dir))


def cmd_localbg(run_dir: str):
    """FREE: paint every background procedurally (no API key, no network)."""
    import carousel_localbg
    carousel_localbg.generate(run_dir, force="--force" in sys.argv)


def cmd_generate(run_dir: str):
    import carousel_generate
    carousel_generate.generate(run_dir)


def cmd_render(run_dir: str):
    import carousel_render
    carousel_render.render(run_dir)


def cmd_export(run_dir: str):
    run_dir = Path(run_dir)
    plan = json.loads((run_dir / "plan.json").read_text())
    dest = cfg.OUTPUT_DIR / plan["slug"]
    dest.mkdir(parents=True, exist_ok=True)
    n = 0
    for slide in plan["slides"]:
        src = slide.get("out_file")
        if src and Path(src).exists():
            shutil.copy2(src, dest / f"{slide['index']:02d}.png")
            n += 1
    print(f"Exported {n} slide(s) -> {dest}")


def cmd_build(run_dir: str):
    """The fully offline path: local backgrounds -> render -> export. Costs nothing."""
    cmd_localbg(run_dir)
    cmd_render(run_dir)
    cmd_export(run_dir)


def cmd_produce(run_dir: str):
    cmd_generate(run_dir)
    cmd_render(run_dir)
    cmd_export(run_dir)


_CMDS = {
    "init": cmd_init,
    "localbg": cmd_localbg,
    "generate": cmd_generate,
    "render": cmd_render,
    "export": cmd_export,
    "build": cmd_build,
    "produce": cmd_produce,
}

def _resolve_run(arg: str) -> str:
    """Accept a full path OR a bare run name (as printed by `init`)."""
    if Path(arg).is_dir():
        return arg
    candidate = cfg.RUNS_DIR / arg
    if candidate.is_dir():
        return str(candidate)
    raise SystemExit(
        f"Run not found: {arg}\n"
        f"Looked in {cfg.RUNS_DIR}. Run `init` first, or pass the path it printed."
    )


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in _CMDS:
        print(__doc__)
        raise SystemExit(1)
    cmd, arg = sys.argv[1], sys.argv[2]
    _CMDS[cmd](arg if cmd == "init" else _resolve_run(arg))
