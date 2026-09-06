import type {
  EllipseNode,
  LineNode,
  Node,
  NoiseNode,
  Paint,
  PathNode,
  RectNode,
  Scene,
  TextLine,
  TextNode,
} from "./scene";
import { cssFont, type Measurer } from "./text";

type Ctx2D = CanvasRenderingContext2D;

/**
 * The painter needs a scratch canvas for the grain pattern. In the browser it
 * makes one from the document; Node (tests, the sample renderer) injects a
 * real Canvas2D implementation here so the exact same code path is exercised.
 */
export type CanvasFactory = (w: number, h: number) => HTMLCanvasElement;

let canvasFactory: CanvasFactory | null = null;

export function setCanvasFactory(f: CanvasFactory | null): void {
  canvasFactory = f;
  noiseCache.clear();
}

function scratchCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (canvasFactory) return canvasFactory(w, h);
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const supportsLetterSpacing = (() => {
  let cached: boolean | null = null;
  return (ctx: Ctx2D) => {
    if (cached === null) cached = "letterSpacing" in ctx;
    return cached;
  };
})();

function resolvePaint(ctx: Ctx2D, p: Paint): string | CanvasGradient {
  if (typeof p === "string") return p;
  const g =
    p.type === "linear"
      ? ctx.createLinearGradient(p.x0, p.y0, p.x1, p.y1)
      : ctx.createRadialGradient(p.cx, p.cy, 0, p.cx, p.cy, p.r);
  for (const s of p.stops) g.addColorStop(Math.min(1, Math.max(0, s.offset)), s.color);
  return g;
}

function roundRectPath(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | [number, number, number, number] = 0,
) {
  const max = Math.min(Math.abs(w), Math.abs(h)) / 2;
  const [tl, tr, br, bl] = (Array.isArray(r) ? r : [r, r, r, r]).map((v) =>
    Math.max(0, Math.min(v, max)),
  ) as [number, number, number, number];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

function applyShadow(ctx: Ctx2D, s: RectNode["shadow"]) {
  if (!s) return;
  ctx.shadowColor = s.color;
  ctx.shadowBlur = s.blur;
  ctx.shadowOffsetX = s.x;
  ctx.shadowOffsetY = s.y;
}

function clearShadow(ctx: Ctx2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function withTransform(ctx: Ctx2D, node: Node, cx: number, cy: number, draw: () => void) {
  const rot = node.rotate ?? 0;
  const alpha = node.opacity ?? 1;
  const needs = rot !== 0 || alpha !== 1;
  if (!needs) return draw();
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (rot !== 0) {
    const [ox, oy] = node.origin ?? [cx, cy];
    ctx.translate(ox, oy);
    ctx.rotate(rot);
    ctx.translate(-ox, -oy);
  }
  draw();
  ctx.restore();
}

function strokeSetup(
  ctx: Ctx2D,
  lineWidth?: number,
  dash?: number[],
  cap?: CanvasLineCap,
  join?: CanvasLineJoin,
) {
  ctx.lineWidth = lineWidth ?? 1;
  ctx.setLineDash(dash ?? []);
  ctx.lineCap = cap ?? "butt";
  ctx.lineJoin = join ?? "miter";
}

/* ------------------------------ nodes ------------------------------ */

function paintRect(ctx: Ctx2D, n: RectNode) {
  withTransform(ctx, n, n.x + n.w / 2, n.y + n.h / 2, () => {
    if (n.fill) {
      applyShadow(ctx, n.shadow);
      ctx.fillStyle = resolvePaint(ctx, n.fill);
      roundRectPath(ctx, n.x, n.y, n.w, n.h, n.r);
      ctx.fill();
      clearShadow(ctx);
    }
    if (n.stroke) {
      ctx.strokeStyle = resolvePaint(ctx, n.stroke);
      strokeSetup(ctx, n.lineWidth, n.dash);
      roundRectPath(ctx, n.x, n.y, n.w, n.h, n.r);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}

function paintEllipse(ctx: Ctx2D, n: EllipseNode) {
  withTransform(ctx, n, n.cx, n.cy, () => {
    ctx.beginPath();
    ctx.ellipse(n.cx, n.cy, Math.abs(n.rx), Math.abs(n.ry), 0, 0, Math.PI * 2);
    if (n.fill) {
      applyShadow(ctx, n.shadow);
      ctx.fillStyle = resolvePaint(ctx, n.fill);
      ctx.fill();
      clearShadow(ctx);
    }
    if (n.stroke) {
      ctx.strokeStyle = resolvePaint(ctx, n.stroke);
      strokeSetup(ctx, n.lineWidth, n.dash);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}

function paintLine(ctx: Ctx2D, n: LineNode) {
  withTransform(ctx, n, (n.x1 + n.x2) / 2, (n.y1 + n.y2) / 2, () => {
    ctx.strokeStyle = resolvePaint(ctx, n.stroke);
    strokeSetup(ctx, n.lineWidth, n.dash, n.cap);
    ctx.beginPath();
    ctx.moveTo(n.x1, n.y1);
    ctx.lineTo(n.x2, n.y2);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function paintPath(ctx: Ctx2D, n: PathNode) {
  withTransform(ctx, n, n.origin?.[0] ?? 0, n.origin?.[1] ?? 0, () => {
    const p = new Path2D(n.d);
    if (n.fill) {
      applyShadow(ctx, n.shadow);
      ctx.fillStyle = resolvePaint(ctx, n.fill);
      ctx.fill(p);
      clearShadow(ctx);
    }
    if (n.stroke) {
      ctx.strokeStyle = resolvePaint(ctx, n.stroke);
      strokeSetup(ctx, n.lineWidth, n.dash, n.cap, n.join);
      ctx.stroke(p);
      ctx.setLineDash([]);
    }
  });
}

const noiseCache = new Map<string, CanvasPattern | null>();

function paintNoise(ctx: Ctx2D, n: NoiseNode) {
  const cell = n.cell ?? 2;
  const seed = n.seed ?? 1;
  const color = n.color ?? "#ffffff";
  const key = `${cell}|${seed}|${color}`;
  let pattern = noiseCache.get(key);
  if (pattern === undefined) {
    const size = 160;
    const tile = scratchCanvas(size, size);
    const tctx = tile?.getContext("2d");
    if (!tile || !tctx) {
      noiseCache.set(key, null);
      return;
    }
    const img = tctx.createImageData(size, size);
    // xorshift keeps grain identical between preview and export.
    let s = seed >>> 0 || 1;
    const rand = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 1000) / 1000;
    };
    const rgb = hexToRgb(color);
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        const a = Math.round(rand() * 255);
        for (let dy = 0; dy < cell && y + dy < size; dy++) {
          for (let dx = 0; dx < cell && x + dx < size; dx++) {
            const i = ((y + dy) * size + (x + dx)) * 4;
            img.data[i] = rgb[0];
            img.data[i + 1] = rgb[1];
            img.data[i + 2] = rgb[2];
            img.data[i + 3] = a;
          }
        }
      }
    }
    tctx.putImageData(img, 0, 0);
    pattern = ctx.createPattern(tile, "repeat");
    noiseCache.set(key, pattern);
  }
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha *= n.amount;
  ctx.fillStyle = pattern;
  ctx.fillRect(n.x, n.y, n.w, n.h);
  ctx.restore();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const v = parseInt(full.slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function paintText(ctx: Ctx2D, n: TextNode, m: Measurer) {
  withTransform(ctx, n, n.x, n.y + (n.lines.length * n.size * n.lineHeight) / 2, () => {
    const spec = {
      font: n.font,
      size: n.size,
      weight: n.weight,
      italic: n.italic,
      letterSpacing: n.letterSpacing,
    };
    const halfLeading = ((n.lineHeight - 1) * n.size) / 2;
    const space = m.width(" ", spec);
    const canLS = supportsLetterSpacing(ctx);
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    n.lines.forEach((line: TextLine, li) => {
      const top = n.y + li * n.size * n.lineHeight + halfLeading;
      let x = n.x;
      if (n.align === "center") x = n.x - line.width / 2;
      else if (n.align === "right") x = n.x - line.width;

      // Marker highlights are painted first so text sits on top.
      let hx = x;
      line.tokens.forEach((t, ti) => {
        if (ti > 0 && !t.glue) hx += space;
        const w = m.width(t.text, {
          ...spec,
          weight: t.style?.weight ?? n.weight,
          italic: t.style?.italic ?? n.italic,
        });
        if (t.style?.highlight) {
          ctx.fillStyle = t.style.highlight;
          const pad = n.size * 0.1;
          ctx.fillRect(hx - pad, top + n.size * 0.16, w + pad * 2, n.size * 0.86);
        }
        hx += w;
      });

      let ti = 0;
      for (const t of line.tokens) {
        if (ti++ > 0 && !t.glue) x += space;
        const weight = t.style?.weight ?? n.weight;
        const italic = t.style?.italic ?? n.italic;
        const w = m.width(t.text, { ...spec, weight, italic });
        ctx.font = cssFont({ ...spec, weight, italic });
        if (n.letterSpacing && canLS) {
          (ctx as unknown as { letterSpacing: string }).letterSpacing = `${n.letterSpacing}px`;
        }
        ctx.fillStyle = t.style?.color
          ? t.style.color
          : resolvePaint(ctx, n.color);
        if (n.letterSpacing && !canLS) {
          let cx = x;
          for (const ch of t.text) {
            ctx.fillText(ch, cx, top);
            cx += m.width(ch, { ...spec, weight, italic, letterSpacing: 0 }) + n.letterSpacing;
          }
        } else {
          ctx.fillText(t.text, x, top);
        }
        if (n.letterSpacing && canLS) {
          (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";
        }
        if (t.style?.underline) {
          ctx.fillStyle = t.style.underline;
          ctx.fillRect(x, top + n.size * 1.02, w, Math.max(1.5, n.size * 0.055));
        }
        if (t.style?.strike) {
          ctx.fillStyle = t.style.strike;
          ctx.fillRect(x, top + n.size * 0.62, w, Math.max(1.5, n.size * 0.055));
        }
        x += w;
      }
    });
  });
}

function paintNode(ctx: Ctx2D, n: Node, m: Measurer) {
  switch (n.kind) {
    case "rect":
      return paintRect(ctx, n);
    case "ellipse":
      return paintEllipse(ctx, n);
    case "line":
      return paintLine(ctx, n);
    case "path":
      return paintPath(ctx, n);
    case "text":
      return paintText(ctx, n, m);
    case "noise":
      return paintNoise(ctx, n);
    case "group": {
      ctx.save();
      if (n.opacity !== undefined) ctx.globalAlpha *= n.opacity;
      if (n.rotate) {
        const [ox, oy] = n.origin ?? [0, 0];
        ctx.translate(ox, oy);
        ctx.rotate(n.rotate);
        ctx.translate(-ox, -oy);
      }
      if (n.clip) {
        roundRectPath(ctx, n.clip.x, n.clip.y, n.clip.w, n.clip.h, n.clip.r ?? 0);
        ctx.clip();
      }
      for (const c of n.children) paintNode(ctx, c, m);
      ctx.restore();
      return;
    }
  }
}

/**
 * Paint a scene into a canvas at `scale`× the scene's logical size.
 * The same function drives both the on-screen preview and the PNG export,
 * so what you see is exactly what downloads.
 */
export function renderScene(
  canvas: HTMLCanvasElement,
  scene: Scene,
  m: Measurer,
  scale = 1,
): void {
  canvas.width = Math.round(scene.w * scale);
  canvas.height = Math.round(scene.h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = resolvePaint(ctx, scene.bg);
  ctx.fillRect(0, 0, scene.w, scene.h);
  ctx.textRendering = "optimizeLegibility";
  for (const n of scene.nodes) paintNode(ctx, n, m);
  ctx.restore();
}
