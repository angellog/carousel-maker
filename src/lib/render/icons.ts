/**
 * Stroke-drawn icon library, authored in a 100×100 box.
 *
 * These exist so presets that reference "an illustration" (notebook, doodle,
 * flowchart, schematic) can draw one without any image-generation model.
 * Paths are stroked, not filled, unless listed in FILLED.
 */

export const ICON_PATHS: Record<string, string> = {
  book:
    "M 50 26 C 40 18 26 16 14 18 L 14 78 C 26 76 40 78 50 86 C 60 78 74 76 86 78 L 86 18 C 74 16 60 18 50 26 Z M 50 26 L 50 86",
  bulb:
    "M 50 14 C 33 14 22 27 22 42 C 22 54 30 60 34 68 L 66 68 C 70 60 78 54 78 42 C 78 27 67 14 50 14 Z M 38 78 L 62 78 M 43 88 L 57 88",
  laptop: "M 24 30 L 76 30 L 76 64 L 24 64 Z M 12 76 L 88 76 L 80 64 L 20 64 Z",
  lock:
    "M 30 46 L 30 34 C 30 23 39 14 50 14 C 61 14 70 23 70 34 L 70 46 M 22 46 L 78 46 L 78 86 L 22 86 Z",
  key:
    "M 34 50 m -16 0 a 16 16 0 1 0 32 0 a 16 16 0 1 0 -32 0 M 50 50 L 86 50 M 74 50 L 74 62 M 62 50 L 62 60",
  shield: "M 50 12 L 84 26 L 84 52 C 84 72 68 84 50 90 C 32 84 16 72 16 52 L 16 26 Z",
  gear:
    "M 50 30 a 20 20 0 1 0 0.1 0 Z M 50 10 L 50 22 M 50 78 L 50 90 M 10 50 L 22 50 M 78 50 L 90 50 M 22 22 L 30 30 M 70 70 L 78 78 M 78 22 L 70 30 M 30 70 L 22 78",
  chart: "M 16 84 L 84 84 M 30 84 L 30 56 M 50 84 L 50 34 M 70 84 L 70 62",
  rocket:
    "M 50 12 C 64 24 70 40 70 56 L 62 72 L 38 72 L 30 56 C 30 40 36 24 50 12 Z M 30 56 L 16 68 L 27 70 M 70 56 L 84 68 L 73 70 M 50 40 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0 M 42 78 L 50 92 L 58 78",
  brain:
    "M 50 18 C 36 12 22 20 22 34 C 14 40 14 54 22 60 C 22 74 36 82 50 76 M 50 18 C 64 12 78 20 78 34 C 86 40 86 54 78 60 C 78 74 64 82 50 76 M 50 18 L 50 76",
  folder: "M 12 26 L 42 26 L 50 36 L 88 36 L 88 80 L 12 80 Z",
  clock: "M 50 50 m -36 0 a 36 36 0 1 0 72 0 a 36 36 0 1 0 -72 0 M 50 28 L 50 52 L 66 62",
  check: "M 20 52 L 42 74 L 82 28",
  cross: "M 26 26 L 74 74 M 74 26 L 26 74",
  arrow: "M 18 50 L 82 50 M 62 32 L 82 50 L 62 68",
  doc:
    "M 26 12 L 60 12 L 78 30 L 78 88 L 26 88 Z M 60 12 L 60 30 L 78 30 M 38 48 L 66 48 M 38 62 L 66 62 M 38 76 L 54 76",
  terminal: "M 12 20 L 88 20 L 88 80 L 12 80 Z M 26 40 L 40 50 L 26 60 M 48 62 L 72 62",
  cloud:
    "M 30 74 C 19 74 12 66 12 56 C 12 46 20 38 30 38 C 34 26 45 18 57 18 C 71 18 82 29 83 43 C 89 46 92 52 92 60 C 92 68 86 74 78 74 Z",
  database:
    "M 50 14 C 68 14 82 20 82 28 C 82 36 68 42 50 42 C 32 42 18 36 18 28 C 18 20 32 14 50 14 Z M 18 28 L 18 72 C 18 80 32 86 50 86 C 68 86 82 80 82 72 L 82 28 M 18 50 C 18 58 32 64 50 64 C 68 64 82 58 82 50",
  search: "M 44 44 m -26 0 a 26 26 0 1 0 52 0 a 26 26 0 1 0 -52 0 M 63 63 L 86 86",
  mail: "M 12 24 L 88 24 L 88 76 L 12 76 Z M 12 24 L 50 54 L 88 24",
  chat: "M 14 20 L 86 20 L 86 66 L 46 66 L 26 84 L 26 66 L 14 66 Z",
  calendar: "M 14 24 L 86 24 L 86 88 L 14 88 Z M 14 42 L 86 42 M 32 12 L 32 32 M 68 12 L 68 32",
  target:
    "M 50 50 m -38 0 a 38 38 0 1 0 76 0 a 38 38 0 1 0 -76 0 M 50 50 m -22 0 a 22 22 0 1 0 44 0 a 22 22 0 1 0 -44 0 M 50 50 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0",
  flag: "M 26 12 L 26 90 M 26 18 L 76 18 L 66 36 L 76 54 L 26 54",
  heart:
    "M 50 84 C 20 62 12 46 12 34 C 12 22 22 14 33 14 C 41 14 47 18 50 24 C 53 18 59 14 67 14 C 78 14 88 22 88 34 C 88 46 80 62 50 84 Z",
  eye:
    "M 8 50 C 22 30 35 22 50 22 C 65 22 78 30 92 50 C 78 70 65 78 50 78 C 35 78 22 70 8 50 Z M 50 50 m -14 0 a 14 14 0 1 0 28 0 a 14 14 0 1 0 -28 0",
  zap: "M 56 8 L 24 56 L 46 56 L 42 92 L 76 44 L 54 44 Z",
  link:
    "M 42 58 L 58 42 M 38 32 L 48 22 C 56 14 68 14 76 22 C 84 30 84 42 76 50 L 66 60 M 62 68 L 52 78 C 44 86 32 86 24 78 C 16 70 16 58 24 50 L 34 40",
  code: "M 34 32 L 12 50 L 34 68 M 66 32 L 88 50 L 66 68 M 58 20 L 44 80",
  cpu:
    "M 28 28 L 72 28 L 72 72 L 28 72 Z M 42 42 L 58 42 L 58 58 L 42 58 Z M 40 28 L 40 14 M 60 28 L 60 14 M 40 72 L 40 86 M 60 72 L 60 86 M 28 40 L 14 40 M 28 60 L 14 60 M 72 40 L 86 40 M 72 60 L 86 60",
  users:
    "M 36 40 m -16 0 a 16 16 0 1 0 32 0 a 16 16 0 1 0 -32 0 M 8 84 C 8 68 20 60 36 60 C 52 60 64 68 64 84 M 66 26 C 76 26 84 34 84 44 C 84 50 81 56 76 59 M 72 84 L 92 84 C 92 72 86 65 76 62",
  cap:
    "M 50 20 L 92 38 L 50 56 L 8 38 Z M 26 46 L 26 70 C 26 78 38 84 50 84 C 62 84 74 78 74 70 L 74 46 M 86 42 L 86 66",
  coffee:
    "M 20 30 L 70 30 L 70 62 C 70 74 60 82 45 82 C 30 82 20 74 20 62 Z M 70 38 L 80 38 C 88 38 92 44 92 50 C 92 56 88 62 80 62 L 70 62 M 16 92 L 74 92",
  clip: "M 66 30 L 66 72 C 66 82 58 90 48 90 C 38 90 30 82 30 72 L 30 26 C 30 19 36 13 43 13 C 50 13 56 19 56 26 L 56 70 C 56 74 53 77 49 77 C 45 77 42 74 42 70 L 42 32",
  pin: "M 50 88 L 50 56 M 50 56 C 62 56 72 46 72 34 C 72 22 62 12 50 12 C 38 12 28 22 28 34 C 28 46 38 56 50 56 Z M 50 34 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0",
  trophy:
    "M 30 14 L 70 14 L 70 42 C 70 54 61 62 50 62 C 39 62 30 54 30 42 Z M 30 20 L 16 20 C 16 34 22 42 31 44 M 70 20 L 84 20 C 84 34 78 42 69 44 M 50 62 L 50 76 M 34 88 L 66 88 L 62 76 L 38 76 Z",
};

export const ICON_NAMES = Object.keys(ICON_PATHS);

/** Icons that read better filled than stroked. */
export const FILLED = new Set(["zap", "heart", "shield"]);

/**
 * Translate + scale an icon's path data into place. Returns path data only,
 * so callers control stroke/fill and can reuse it inside any node.
 */
export function iconPath(name: string, x: number, y: number, size: number): string {
  const raw = ICON_PATHS[name];
  if (!raw) return "";
  const k = size / 100;
  // Rewrite every numeric pair in the path. Arc flags are 0/1 and must not be
  // scaled, so `a`/`A` segments are handled with an explicit parameter cursor.
  return raw.replace(/([MLCQZAmlcqza])|(-?\d*\.?\d+)/g, (() => {
    let cmd = "";
    let n = 0;
    return (tok: string) => {
      if (/[MLCQZAmlcqza]/.test(tok)) {
        cmd = tok;
        n = 0;
        return tok;
      }
      const v = parseFloat(tok);
      const i = n++;
      if (cmd === "a" || cmd === "A") {
        const p = i % 7;
        // rx ry xrot largeArc sweep dx dy
        if (p === 2 || p === 3 || p === 4) return tok;
        if (p === 0 || p === 1) return String(+(v * k).toFixed(2));
        // Relative arcs (lowercase) take deltas; absolute take coordinates.
        return String(+(cmd === "a" ? v * k : (p === 5 ? x + v * k : y + v * k)).toFixed(2));
      }
      if (cmd === "m" || cmd === "l" || cmd === "c" || cmd === "q") {
        return String(+(v * k).toFixed(2));
      }
      return String(+((i % 2 === 0 ? x : y) + v * k).toFixed(2));
    };
  })());
}

export function hasIcon(name: string): boolean {
  return name in ICON_PATHS;
}

/** Deterministically pick an icon from a word — used to illustrate bullets. */
export function iconFor(text: string, pool: string[] = ICON_NAMES): string {
  const t = text.toLowerCase();
  const direct: [RegExp, string][] = [
    [/secur|safe|protect|risk|vulnerab/, "shield"],
    [/lock|encrypt|privat|password/, "lock"],
    [/key|token|api key|credential/, "key"],
    [/learn|course|study|school|educat/, "cap"],
    [/idea|insight|tip|creativ|inspir/, "bulb"],
    [/read|book|guide|doc|chapter/, "book"],
    [/launch|ship|start|scale/, "rocket"],
    [/time|hour|fast|speed|minute|deadline/, "clock"],
    [/grow|chart|metric|revenue|data|analytic/, "chart"],
    [/think|brain|mental|model|ai\b|intellig/, "brain"],
    [/code|develop|program|script/, "code"],
    [/terminal|command|cli|shell/, "terminal"],
    [/cloud|host|deploy|server/, "cloud"],
    [/database|storage|sql|record/, "database"],
    [/search|find|discover|research/, "search"],
    [/email|mail|newsletter|inbox/, "mail"],
    [/chat|message|comment|conversat|reply/, "chat"],
    [/calendar|schedule|week|month|plan/, "calendar"],
    [/goal|target|aim|focus|objectiv/, "target"],
    [/team|people|user|customer|audience|communit/, "users"],
    [/win|best|top|award|rank/, "trophy"],
    [/link|connect|integrat/, "link"],
    [/power|energy|instant|quick|boost/, "zap"],
    [/file|folder|organi[sz]e/, "folder"],
    [/watch|see|view|visib|notice/, "eye"],
    [/love|like|favou?rite|save/, "heart"],
    [/config|setting|system|process|workflow/, "gear"],
    [/laptop|screen|desktop|device|app\b/, "laptop"],
    [/note|write|writing|draft/, "doc"],
    [/coffee|habit|morning|daily|routine/, "coffee"],
    [/flag|milestone|stage|phase/, "flag"],
    [/pin|import|remember|key point/, "pin"],
    [/attach|append|include/, "clip"],
    [/chip|hardware|compute|processor|gpu/, "cpu"],
  ];
  for (const [re, name] of direct) if (re.test(t) && pool.includes(name)) return name;
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
