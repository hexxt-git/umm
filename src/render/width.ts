// Display-width measurement: wrapping must count columns, not characters. ANSI
// escapes are zero columns, CJK/most emoji are two, combining marks are zero.
const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /[][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

// Two-column codepoints (East Asian Width W/F), abridged to the blocks that
// actually show up in answers.
function isWide(cp: number): boolean {
  return (
    cp >= 0x1100 &&
    (cp <= 0x115f || // Hangul Jamo
      cp === 0x2329 ||
      cp === 0x232a ||
      (cp >= 0x2e80 && cp <= 0x303e) || // CJK radicals, Kangxi
      (cp >= 0x3041 && cp <= 0x33ff) || // Hiragana .. CJK symbols
      (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Ext A
      (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified
      (cp >= 0xa000 && cp <= 0xa4cf) || // Yi
      (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
      (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat
      (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compat forms
      (cp >= 0xff00 && cp <= 0xff60) || // fullwidth forms
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1faff) || // emoji, symbols, pictographs
      (cp >= 0x20000 && cp <= 0x3fffd)) // CJK Ext B+
  );
}

function isZeroWidth(cp: number): boolean {
  return (
    cp === 0x200d || // ZWJ
    cp === 0x20e3 || // combining enclosing keycap
    (cp >= 0x1f3fb && cp <= 0x1f3ff) || // emoji skin-tone modifiers
    (cp >= 0x0300 && cp <= 0x036f) || // combining diacriticals
    (cp >= 0x200b && cp <= 0x200f) || // zero-width space/marks
    (cp >= 0xfe00 && cp <= 0xfe0f) || // variation selectors
    (cp >= 0xe0100 && cp <= 0xe01ef) || // supplementary variation selectors
    /\p{Mark}/u.test(String.fromCodePoint(cp))
  );
}

function isRegionalIndicator(cp: number): boolean {
  return cp >= 0x1f1e6 && cp <= 0x1f1ff;
}

export interface TerminalSegment {
  text: string;
  width: number;
}

// Groups the emoji sequences that terminals draw as one cell cluster. This is
// deliberately smaller than a full Unicode grapheme-break implementation, but
// covers ZWJ emoji, flags, skin tones, keycaps, and combining marks.
export function terminalSegments(s: string): TerminalSegment[] {
  const segments: string[] = [];
  let current = "";
  let regionalCount = 0;

  const push = () => {
    if (current) segments.push(current);
    current = "";
    regionalCount = 0;
  };

  for (const char of s) {
    const cp = char.codePointAt(0)!;
    const previousEndsWithJoiner = current.endsWith("\u200d");
    if (!current) {
      current = char;
      regionalCount = isRegionalIndicator(cp) ? 1 : 0;
    } else if (isZeroWidth(cp) || previousEndsWithJoiner) {
      current += char;
    } else if (isRegionalIndicator(cp) && regionalCount === 1) {
      current += char;
      regionalCount = 2;
    } else {
      push();
      current = char;
      regionalCount = isRegionalIndicator(cp) ? 1 : 0;
    }
  }
  push();

  return segments.map((text) => {
    const points = [...text].map((char) => char.codePointAt(0)!);
    const emojiCluster =
      text.includes("\u200d") ||
      text.includes("\ufe0f") ||
      points.some((cp) => cp === 0x20e3 || (cp >= 0x1f3fb && cp <= 0x1f3ff)) ||
      points.filter(isRegionalIndicator).length === 2;
    const width = emojiCluster
      ? 2
      : points.reduce(
          (sum, cp) => sum + (isZeroWidth(cp) ? 0 : isWide(cp) ? 2 : 1),
          0,
        );
    return { text, width };
  });
}

export function displayWidth(s: string): number {
  const plain = stripAnsi(s);
  return terminalSegments(plain).reduce(
    (sum, segment) => sum + segment.width,
    0,
  );
}

// Cuts to `max` columns, ellipsis included. Assumes plain text.
export function truncate(s: string, max: number): string {
  if (max <= 0) return "";
  if (displayWidth(s) <= max) return s;
  let out = "";
  let width = 0;
  for (const segment of terminalSegments(s)) {
    if (width + segment.width > max - 1) break;
    out += segment.text;
    width += segment.width;
  }
  return out + "…";
}

// Right-pads to `width` columns so adjacent columns line up.
export function padTo(s: string, width: number): string {
  return s + " ".repeat(Math.max(0, width - displayWidth(s)));
}
