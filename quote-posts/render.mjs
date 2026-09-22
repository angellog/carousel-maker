// Renders every post in posts.json to a 1080x1350 PNG using headless Chrome.
// Usage: node quote-posts/render.mjs [id ...]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "output");
const htmlDir = join(out, "html");
mkdirSync(htmlDir, { recursive: true });

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { signature, handle, posts } = JSON.parse(readFileSync(join(root, "posts.json"), "utf8"));
const only = process.argv.slice(2);

// Muted paper tones, one per mood.
const PAPER = {
  mustard: "#E2AC4E",
  sage: "#B7BFA0",
  cream: "#EFE6D2",
  rose: "#E3B7A8",
  sky: "#B9CCD4",
  clay: "#D4876A",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const page = (p) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Short+Stack&display=block" rel="stylesheet">
<style>
  html,body{margin:0;width:1080px;height:1350px;overflow:hidden}
  body{background:${PAPER[p.bg]};position:relative;font-family:"Short Stack",cursive;color:#1d1b18}
  .grain{position:absolute;inset:0;opacity:.35;mix-blend-mode:multiply}
  .quote{position:absolute;left:118px;top:50%;transform:translateY(-54%);
    font-size:56px;line-height:1.62;letter-spacing:.07em;white-space:nowrap}
  .sig{position:absolute;right:92px;bottom:96px;font-size:28px;letter-spacing:.14em;opacity:.85}
</style></head><body>
<svg class="grain" width="1080" height="1350"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .3  0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
<div class="quote" id="q">${p.lines.map(esc).join("<br>")}</div>
<div class="sig">${esc(signature)}</div>
<script>
  document.fonts.ready.then(() => {
    const q = document.getElementById("q");
    let s = 56;
    while (q.scrollWidth > 1080 - 118 - 110 && s > 34) q.style.fontSize = (s -= 1) + "px";
  });
</script>
</body></html>`;

for (const p of posts) {
  if (only.length && !only.includes(p.id)) continue;
  const html = join(htmlDir, `post-${p.id}.html`);
  writeFileSync(html, page(p));
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=1080,1350", "--virtual-time-budget=6000",
    `--screenshot=${join(out, `post-${p.id}.png`)}`, `file://${html}`,
  ], { stdio: "ignore" });
  console.log(`rendered post-${p.id}.png`);
}

// Publishing sheet: caption + hashtags per post, ready to paste or feed to a scheduler.
const sheet = posts.map((p) =>
  `## Post ${p.id} — ${p.pillar}\n\nImage: output/post-${p.id}.png\n\n` +
  "```\n" + `${p.caption}\n\nby ${handle}\n\n${p.tags}` + "\n```\n"
).join("\n");
writeFileSync(join(out, "captions.md"), `# Captions — first 15 posts\n\n${sheet}`);
writeFileSync(join(out, "captions.json"), JSON.stringify(posts.map((p) => ({
  id: p.id, image: `post-${p.id}.png`, caption: `${p.caption}\n\nby ${handle}\n\n${p.tags}`,
})), null, 2));
console.log("wrote captions.md + captions.json");
