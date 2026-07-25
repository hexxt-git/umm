// Minimal ANSI styling: a `style` helper wraps text in SGR codes, a `theme`
// names the colors so the look is tunable in one place.
let enabled = true;
export function setColorEnabled(on: boolean): void {
  enabled = on;
}

const ESC = "\x1b[";
const RESET = `${ESC}0m`;

export interface Sgr {
  open: string;
  close: string;
}

function code(open: number, close: number): Sgr {
  return { open: `${ESC}${open}m`, close: `${ESC}${close}m` };
}

// Truecolor foreground; terminals without it degrade to nearest.
function fg(r: number, g: number, b: number): Sgr {
  return { open: `${ESC}38;2;${r};${g};${b}m`, close: `${ESC}39m` };
}

export const sgr = {
  bold: code(1, 22),
  dim: code(2, 22),
  italic: code(3, 23),
  underline: code(4, 24),
  strike: code(9, 29),
  reset: RESET,
};

export const theme = {
  heading: fg(137, 180, 250), // soft blue
  accent: fg(148, 226, 213), // teal — bold spans
  code: fg(243, 139, 168), // rose — inline code
  codeBlock: fg(166, 173, 200), // muted — fenced blocks
  link: fg(137, 220, 235), // cyan
  rule: sgr.dim,
  bullet: fg(249, 226, 175), // amber
  quote: sgr.dim,
  tableBorder: sgr.dim,
};

// When color is disabled, bold/underline still pass through (structural
// emphasis); pure-color styles collapse to plain text.
export function style(text: string, ...styles: Sgr[]): string {
  if (!enabled) {
    let out = text;
    for (const s of styles) {
      if (s === sgr.bold) out = `${sgr.bold.open}${out}${sgr.bold.close}`;
      if (s === sgr.underline)
        out = `${sgr.underline.open}${out}${sgr.underline.close}`;
    }
    return out;
  }
  let open = "";
  let close = "";
  for (const s of styles) {
    open += s.open;
    close = s.close + close;
  }
  return `${open}${text}${close}`;
}

// OSC 8 hyperlink: clickable in supporting terminals, plain text elsewhere.
export function hyperlink(text: string, url: string): string {
  if (!enabled) return text;
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}
