// Inline markdown -> styled runs -> width-aware wrapped lines.
//
// A "run" is a chunk of text with a style set. Parsing to runs first, then
// wrapping over runs, means: (a) width is measured on visible text only, and
// (b) styles never bleed past a line break, because each word re-emits its own
// escapes. Supported spans: `code`, **bold**, *italic*, ~~strike~~, [t](url).
// No HTML — raw tags are passed through as literal text.
import { style, hyperlink, sgr, theme } from "./ansi.js";
import { displayWidth } from "./width.js";

type StyleName = "bold" | "italic" | "code" | "strike";

interface Run {
  text: string;
  styles: Set<StyleName>;
  href?: string;
}

// Finds the matching closing delimiter for `delim` starting at `from`.
function findClose(text: string, delim: string, from: number): number {
  return text.indexOf(delim, from);
}

// Parses inline text into runs, carrying an inherited style set for recursion.
function parse(text: string, inherited: Set<StyleName>): Run[] {
  const runs: Run[] = [];
  let buf = "";
  let i = 0;

  const flush = () => {
    if (buf) {
      runs.push({ text: buf, styles: new Set(inherited) });
      buf = "";
    }
  };

  while (i < text.length) {
    const c = text[i];

    // backslash escape: next char is literal
    if (c === "\\" && i + 1 < text.length) {
      buf += text[i + 1];
      i += 2;
      continue;
    }

    // inline code: verbatim, no nested parsing
    if (c === "`") {
      const close = findClose(text, "`", i + 1);
      if (close !== -1) {
        flush();
        const inner = text.slice(i + 1, close);
        const styles = new Set(inherited);
        styles.add("code");
        runs.push({ text: inner, styles });
        i = close + 1;
        continue;
      }
    }

    // link: [label](url)
    if (c === "[") {
      const closeBracket = findClose(text, "]", i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === "(") {
        const closeParen = findClose(text, ")", closeBracket + 2);
        if (closeParen !== -1) {
          flush();
          const label = text.slice(i + 1, closeBracket);
          const url = text.slice(closeBracket + 2, closeParen);
          for (const r of parse(label, inherited)) {
            runs.push({ ...r, href: url });
          }
          i = closeParen + 1;
          continue;
        }
      }
    }

    // emphasis delimiters, longest first
    const two = text.slice(i, i + 2);
    if (
      (two === "**" || two === "__" || two === "~~") &&
      text[i + 2] !== undefined
    ) {
      const close = findClose(text, two, i + 2);
      if (close !== -1) {
        flush();
        const name: StyleName = two === "~~" ? "strike" : "bold";
        const styles = new Set(inherited);
        styles.add(name);
        runs.push(...parse(text.slice(i + 2, close), styles));
        i = close + 2;
        continue;
      }
    }
    if (
      (c === "*" || c === "_") &&
      text[i + 1] !== undefined &&
      text[i + 1] !== c
    ) {
      const close = findClose(text, c, i + 1);
      if (close !== -1) {
        flush();
        const styles = new Set(inherited);
        styles.add("italic");
        runs.push(...parse(text.slice(i + 1, close), styles));
        i = close + 1;
        continue;
      }
    }

    buf += c;
    i += 1;
  }

  flush();
  return runs;
}

// Serializes a single run to a styled terminal string.
function renderRun(run: Run): string {
  let out = run.text;
  const styles: Parameters<typeof style>[1][] = [];
  if (run.styles.has("code")) styles.push(theme.code);
  if (run.styles.has("bold")) styles.push(sgr.bold, theme.accent);
  if (run.styles.has("italic")) styles.push(sgr.italic);
  if (run.styles.has("strike")) styles.push(sgr.strike);
  if (styles.length) out = style(out, ...styles);
  if (run.href)
    out = style(hyperlink(out, run.href), theme.link, sgr.underline);
  return out;
}

export interface Word {
  runs: Run[]; // consecutive runs forming one whitespace-delimited word
  width: number;
}

// Splits runs into whitespace-delimited words, preserving each fragment's
// style. Width is display columns of the visible text.
function toWords(runs: Run[]): Word[] {
  const words: Word[] = [];
  let cur: Run[] = [];
  let curWidth = 0;

  const push = () => {
    if (cur.length) {
      words.push({ runs: cur, width: curWidth });
      cur = [];
      curWidth = 0;
    }
  };

  for (const run of runs) {
    const parts = run.text.split(/(\s+)/);
    for (const part of parts) {
      if (part === "") continue;
      if (/^\s+$/.test(part)) {
        push();
      } else {
        cur.push({ ...run, text: part });
        curWidth += displayWidth(part);
      }
    }
  }
  push();
  return words;
}

// Parses inline text and wraps it to `width` columns, returning styled lines.
export function renderInline(text: string, width: number): string[] {
  const words = toWords(parse(text, new Set()));
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let line: Word[] = [];
  let lineWidth = 0;

  for (const word of words) {
    const add = (line.length ? 1 : 0) + word.width; // +1 for the joining space
    if (line.length && lineWidth + add > width) {
      lines.push(serialize(line));
      line = [word];
      lineWidth = word.width;
    } else {
      line.push(word);
      lineWidth += add;
    }
  }
  if (line.length) lines.push(serialize(line));
  return lines;
}

function serialize(words: Word[]): string {
  return words.map((w) => w.runs.map(renderRun).join("")).join(" ");
}

// Parses inline without wrapping — for contexts (table cells, headings) that
// manage their own layout. Returns one styled string.
export function renderInlineFlat(text: string): string {
  return parse(text, new Set()).map(renderRun).join("");
}
