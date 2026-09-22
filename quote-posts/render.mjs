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

// Paper colors. Dark papers get cream ink so the grid has contrast "anchors".
const PAPER = {
  cream:      { bg: "#F3EAD7", ink: "#1d1b18" },
  lemon:      { bg: "#F4DC6E", ink: "#1d1b18" },
  mustard:    { bg: "#E8AE3F", ink: "#1d1b18" },
  tangerine:  { bg: "#F2934F", ink: "#1d1b18" },
  coral:      { bg: "#F07F72", ink: "#1d1b18" },
  blush:      { bg: "#F5C3C6", ink: "#1d1b18" },
  lilac:      { bg: "#CDB9E6", ink: "#1d1b18" },
  periwinkle: { bg: "#A3B6EE", ink: "#1d1b18" },
  sky:        { bg: "#AED8E6", ink: "#1d1b18" },
  mint:       { bg: "#B7E2C6", ink: "#1d1b18" },
  sage:       { bg: "#B3C49C", ink: "#1d1b18" },
  terracotta: { bg: "#C4623F", ink: "#FBF3E4" },
  forest:     { bg: "#2F4A3A", ink: "#F3EAD7" },
  navy:       { bg: "#23324F", ink: "#F3EAD7" },
  plum:       { bg: "#5A3A5D", ink: "#F6E4EA" },
};

// Handwritten Google Fonts. size/ls/lh are tuned so each reads at the same visual weight.
const FONTS = {
  short:      { family: "Short Stack",         size: 56, ls: ".07em", lh: 1.62 },
  patrick:    { family: "Patrick Hand",        size: 72, ls: ".03em", lh: 1.45 },
  caveat:     { family: "Caveat",              size: 88, ls: ".01em", lh: 1.3, weight: 500 },
  gochi:      { family: "Gochi Hand",          size: 70, ls: ".03em", lh: 1.45 },
  kalam:      { family: "Kalam",               size: 62, ls: ".02em", lh: 1.55 },
  gaegu:      { family: "Gaegu",               size: 76, ls: ".02em", lh: 1.4, weight: 700 },
  architects: { family: "Architects Daughter", size: 64, ls: ".04em", lh: 1.62 },
  nanum:      { family: "Nanum Pen Script",    size: 96, ls: ".01em", lh: 1.2 },
};
const FONT_ORDER = Object.keys(FONTS);
const fontFor = (p, i) => FONTS[p.font] || FONTS[FONT_ORDER[i % FONT_ORDER.length]];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const page = (p, i) => {
  const c = PAPER[p.bg], f = fontFor(p, i), dark = c.ink !== "#1d1b18";
  const url = `https://fonts.googleapis.com/css2?family=${f.family.replace(/ /g, "+")}${f.weight ? `:wght@${f.weight}` : ""}&display=block`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="${url}" rel="stylesheet">
<style>
  html,body{margin:0;width:1080px;height:1350px;overflow:hidden}
  body{background:${c.bg};position:relative;font-family:"${f.family}",cursive;font-weight:${f.weight || 400};color:${c.ink}}
  .grain{position:absolute;inset:0;opacity:${dark ? .22 : .35};mix-blend-mode:${dark ? "screen" : "multiply"}}
  .quote{position:absolute;left:118px;top:50%;transform:translateY(-54%);
    font-size:${f.size}px;line-height:${f.lh};letter-spacing:${f.ls};white-space:nowrap}
  .sig{position:absolute;right:92px;bottom:96px;font-size:${Math.round(f.size * .5)}px;letter-spacing:.14em;opacity:.85}
</style></head><body>
<svg class="grain" width="1080" height="1350"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .38  0 0 0 0 .3  0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
<div class="quote" id="q">${p.lines.map(esc).join("<br>")}</div>
<div class="sig">${esc(signature)}</div>
<script>
  document.fonts.ready.then(() => {
    const q = document.getElementById("q");
    let s = ${f.size};
    while ((q.scrollWidth > 1080 - 118 - 110 || q.scrollHeight > 820) && s > 34) q.style.fontSize = (s -= 1) + "px";
  });
</script>
</body></html>`;
};

posts.forEach((p, i) => {
  if (only.length && !only.includes(p.id)) return;
  const html = join(htmlDir, `post-${p.id}.html`);
  writeFileSync(html, page(p, i));
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=1080,1350", "--virtual-time-budget=6000",
    `--screenshot=${join(out, `post-${p.id}.png`)}`, `file://${html}`,
  ], { stdio: "ignore" });
  console.log(`rendered post-${p.id}.png`);
});

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

// Profile-grid preview: newest post top-left, 3 columns, 3:4 tiles like the IG profile grid.
if (!only.length) {
  const tiles = [...posts].reverse().map((p) =>
    `<div class="t"><img src="../post-${p.id}.png"></div>`).join("");
  const grid = join(htmlDir, "feed.html");
  writeFileSync(grid, `<!doctype html><html><body style="margin:0;background:#fff">
<style>.g{display:grid;grid-template-columns:repeat(3,360px);gap:3px}.t{height:480px;overflow:hidden}
.t img{width:100%;height:100%;object-fit:cover}</style><div class="g">${tiles}</div></body></html>`);
  const rows = Math.ceil(posts.length / 3);
  execFileSync(CHROME, ["--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--window-size=1086,${rows * 483}`, "--virtual-time-budget=3000",
    `--screenshot=${join(out, "feed-preview.png")}`, `file://${grid}`], { stdio: "ignore" });
  console.log("wrote feed-preview.png");
}
