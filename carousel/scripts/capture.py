"""Capture a web screenshot for use inside a carousel slide.

Uses headless Chromium (Playwright). Handles cookie/consent banners, triggers
lazy-loaded content by scrolling, then screenshots either the whole page, a CSS
element, or an explicit clip box. Saves a PNG you can drop into a slide's
`content` block as {"type":"image", ...}.

Examples:
  # full-page probe (to find where a chart lives)
  python capture.py "https://example.com/post" ../assets/shots/probe.png --full
  # tight crop by pixel box (x,y,width,height in CSS px at the given --width)
  python capture.py "https://example.com/post" ../assets/shots/chart.png --clip 120,2400,900,560
  # by CSS selector (best when the element is stable)
  python capture.py "https://example.com/post" ../assets/shots/chart.png --selector "figure.benchmark"

Always credit the source in the slide caption (e.g. "via anthropic.com").
"""
import argparse
from pathlib import Path


COOKIE_LABELS = ["Reject all", "Reject non-essential", "Reject", "Decline", "Only necessary",
                 "Accept all cookies", "Accept all", "I agree", "Got it", "Allow all"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("out")
    ap.add_argument("--selector", help="CSS selector of the element to capture")
    ap.add_argument("--clip", help="x,y,width,height in CSS px (at --width)")
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--height", type=int, default=1600)
    ap.add_argument("--scale", type=int, default=2, help="device scale (2 = retina/crisp)")
    ap.add_argument("--full", action="store_true", help="full-page screenshot")
    ap.add_argument("--wait", type=int, default=1800, help="ms to wait after load/scroll")
    a = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit("pip install playwright && playwright install chromium")

    UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--disable-blink-features=AutomationControlled"])
        ctx = browser.new_context(viewport={"width": a.width, "height": a.height},
                                  device_scale_factor=a.scale, user_agent=UA,
                                  locale="en-US", extra_http_headers={"Accept-Language": "en-US,en;q=0.9"})
        # hide the headless/automation fingerprint some sites block on
        ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
        page = ctx.new_page()
        try:
            page.goto(a.url, wait_until="networkidle", timeout=45000)
        except Exception:
            page.goto(a.url, wait_until="domcontentloaded", timeout=45000)

        # Dismiss cookie/consent banners (best effort, privacy-preserving first).
        for label in COOKIE_LABELS:
            try:
                btn = page.get_by_role("button", name=label, exact=False)
                if btn.count():
                    btn.first.click(timeout=1200)
                    page.wait_for_timeout(400)
                    break
            except Exception:
                pass

        # Trigger lazy-loaded / scroll-animated content, then return to top.
        page.evaluate("""async () => {
            const h = document.body.scrollHeight;
            for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
            window.scrollTo(0, 0);
        }""")
        page.wait_for_timeout(a.wait)

        if a.selector:
            el = page.locator(a.selector).first
            el.scroll_into_view_if_needed()
            page.wait_for_timeout(600)
            el.screenshot(path=a.out)
        elif a.clip:
            x, y, w, h = (float(v) for v in a.clip.split(","))
            page.screenshot(path=a.out, clip={"x": x, "y": y, "width": w, "height": h})
        else:
            page.screenshot(path=a.out, full_page=a.full)
        browser.close()
    print("saved:", a.out)


if __name__ == "__main__":
    main()
