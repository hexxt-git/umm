// ANSI styling — the "chalk rewrite", kept deliberately small. A single `style`
// helper wraps text in SGR codes; a `theme` names the colors so the whole look
// is tunable in one place and can go monochrome when color is disabled.

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

// Truecolor foreground; terminals without it degrade gracefully to nearest.
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

// A restrained, theme-agnostic palette. These are the only colors the renderer
// reaches for, so retheming is a one-object edit.
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

// Applies one or more SGR styles to a string. When color is disabled, bold and
// underline still pass through (they carry meaning without color); pure-color
// styles collapse to plain text.
export function style(text: string, ...styles: Sgr[]): string {
  if (!enabled) {
    // keep structural emphasis even without color
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

// Wraps text in an OSC 8 hyperlink so supporting terminals make it clickable
// without printing the raw URL. Falls back to plain styled text elsewhere.
export function hyperlink(text: string, url: string): string {
  if (!enabled) return text;
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}
