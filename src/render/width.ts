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
    cp === 0xfe0f || // variation selector-16 (emoji presentation)
    (cp >= 0x0300 && cp <= 0x036f) || // combining diacriticals
    (cp >= 0x200b && cp <= 0x200f) || // zero-width space/marks
    (cp >= 0xfe00 && cp <= 0xfe0e) // variation selectors 1-15
  );
}

export function displayWidth(s: string): number {
  const plain = stripAnsi(s);
  let width = 0;
  for (const ch of plain) {
    const cp = ch.codePointAt(0)!;
    if (isZeroWidth(cp)) continue;
    width += isWide(cp) ? 2 : 1;
  }
  return width;
}
