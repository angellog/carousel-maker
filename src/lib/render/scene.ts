/** Display-list primitives. The painter walks these; presets emit them. */

export interface GradientStop {
  offset: number;
  color: string;
}

export type Paint =
  | string
  | { type: "linear"; x0: number; y0: number; x1: number; y1: number; stops: GradientStop[] }
  | { type: "radial"; cx: number; cy: number; r: number; stops: GradientStop[] };

export interface SpanStyle {
  color?: string;
  weight?: number;
  italic?: boolean;
  /** Marker-pen fill drawn behind the text. */
  highlight?: string;
  underline?: string;
  strike?: string;
}

/** A measured word (or punctuation run) inside a text line. */
export interface Token {
  text: string;
  style?: SpanStyle;
  /**
   * True when no space precedes this token — used for punctuation that follows
   * a markup boundary, e.g. the comma in `**Outcome**, not the hours`. Glued
   * tokens never start a line and are never separated from the word before.
   */
  glue?: boolean;
}

export interface TextLine {
  tokens: Token[];
  /** Advance width in px at the node's font size. */
  width: number;
}

export type TextAlign = "left" | "center" | "right";

export interface Shadow {
  color: string;
  blur: number;
  x: number;
  y: number;
}

interface Base {
  opacity?: number;
  /** Radians, applied about `origin` (defaults to the node's own centre). */
  rotate?: number;
  origin?: [number, number];
}

export interface RectNode extends Base {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius; number or [tl, tr, br, bl]. */
  r?: number | [number, number, number, number];
  fill?: Paint;
  stroke?: Paint;
  lineWidth?: number;
  dash?: number[];
  shadow?: Shadow;
}

export interface EllipseNode extends Base {
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill?: Paint;
  stroke?: Paint;
  lineWidth?: number;
  dash?: number[];
  shadow?: Shadow;
}

export interface LineNode extends Base {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: Paint;
  lineWidth?: number;
  dash?: number[];
  cap?: CanvasLineCap;
}

export interface PathNode extends Base {
  kind: "path";
  /** SVG path data (M, L, C, Q, A, Z supported by Path2D). */
  d: string;
  fill?: Paint;
  stroke?: Paint;
  lineWidth?: number;
  dash?: number[];
  cap?: CanvasLineCap;
  join?: CanvasLineJoin;
  shadow?: Shadow;
}

export interface TextNode extends Base {
  kind: "text";
  /** Anchor x: left/centre/right edge depending on `align`. */
  x: number;
  /** Baseline-independent: y is the TOP of the first line's box. */
  y: number;
  lines: TextLine[];
  font: string;
  size: number;
  weight: number;
  italic?: boolean;
  lineHeight: number;
  color: Paint;
  align: TextAlign;
  letterSpacing?: number;
  /** Width of the layout box; needed for centre/right alignment. */
  boxWidth: number;
}

/** Procedural film grain — replaces the "textured background" an image model would make. */
export interface NoiseNode extends Base {
  kind: "noise";
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0..1 */
  amount: number;
  /** Pixel size of each grain cell. */
  cell?: number;
  seed?: number;
  color?: string;
}

export interface GroupNode extends Base {
  kind: "group";
  children: Node[];
  clip?: { x: number; y: number; w: number; h: number; r?: number };
}

export type Node =
  | RectNode
  | EllipseNode
  | LineNode
  | PathNode
  | TextNode
  | NoiseNode
  | GroupNode;

export interface Scene {
  w: number;
  h: number;
  bg: Paint;
  nodes: Node[];
}
