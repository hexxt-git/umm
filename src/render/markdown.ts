// Block-level markdown -> terminal. Line-based parser; inline styling and
// width-aware wrapping are delegated to inline.ts / width.ts. No HTML.
import { style, sgr, theme, setColorEnabled } from "./ansi.js";
import { renderInline, renderInlineFlat } from "./inline.js";
import { displayWidth, stripAnsi } from "./width.js";

const MAX_WIDTH = 90;

function termWidth(): number {
  const cols = process.stdout.columns || 80;
  return Math.min(cols, MAX_WIDTH);
}

const isBlank = (l: string) => l.trim() === "";
const isFence = (l: string) => /^\s*```/.test(l);
const isHr = (l: string) => /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);
const isHeading = (l: string) => /^#{1,6}\s/.test(l);
const isQuote = (l: string) => /^\s*>\s?/.test(l);
const listMatch = (l: string) => /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(l);
const isTableSep = (l: string) =>
  /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(l) && l.includes("-");
const isTableRow = (l: string) => l.trim().startsWith("|") || l.includes(" | ");

function padTo(s: string, w: number): string {
  const gap = w - displayWidth(s);
  return gap > 0 ? s + " ".repeat(gap) : s;
}

function renderHeading(line: string): string[] {
  const m = /^(#{1,6})\s+(.*)$/.exec(line)!;
  const level = m[1].length;
  const text = renderInlineFlat(m[2]);
  const styled = style(text, theme.heading, sgr.bold);
  if (level === 1) {
    const rule = style(
      "─".repeat(displayWidth(stripAnsi(text))),
      theme.heading,
    );
    return [styled, rule];
  }
  return [styled];
}

function renderParagraph(lines: string[], width: number): string[] {
  return renderInline(lines.join(" "), width);
}

function renderQuote(lines: string[], width: number): string[] {
  const inner = lines.map((l) => l.replace(/^\s*>\s?/, "")).join(" ");
  const bar = style("│ ", theme.quote);
  return renderInline(inner, width - 2).map((l) => bar + style(l, sgr.dim));
}

function renderCode(lines: string[]): string[] {
  const bar = style("▏", theme.codeBlock);
  const out = lines.map((l) => `${bar} ${style(l, theme.codeBlock)}`);
  return out;
}

// Nesting is by leading indentation.
function renderList(items: string[], width: number): string[] {
  const out: string[] = [];
  for (const raw of items) {
    const m = listMatch(raw)!;
    const indent = m[1].length;
    const marker = m[2];
    const content = m[3];
    const depth = Math.floor(indent / 2);
    const pad = "  ".repeat(depth);
    const ordered = /\d/.test(marker);
    const bulletText = ordered ? `${marker} ` : "• ";
    const bullet = style(bulletText, theme.bullet);
    const hang = pad + " ".repeat(displayWidth(bulletText));
    const avail = width - displayWidth(pad) - displayWidth(bulletText);
    const wrapped = renderInline(content, Math.max(avail, 8));
    wrapped.forEach((l, idx) => {
      out.push(idx === 0 ? pad + bullet + l : hang + l);
    });
  }
  return out;
}

function renderTable(rows: string[], width: number): string[] {
  const parse = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());

  const header = parse(rows[0]);
  const body = rows.slice(2).map(parse); // rows[1] is the separator row
  const cols = header.length;

  const rendered = [header, ...body].map((r) =>
    Array.from({ length: cols }, (_, i) => renderInlineFlat(r[i] ?? "")),
  );

  const widths = Array.from({ length: cols }, (_, i) =>
    Math.max(...rendered.map((r) => displayWidth(r[i]))),
  );

  const V = style("│", theme.tableBorder);
  const line = (cells: string[], bold: boolean) =>
    V +
    cells
      .map((c, i) => {
        const cell = bold ? style(c, sgr.bold) : c;
        return " " + padTo(cell, widths[i]) + " ";
      })
      .join(V) +
    V;

  const border = (l: string, m: string, r: string) =>
    style(
      l + widths.map((w) => "─".repeat(w + 2)).join(m) + r,
      theme.tableBorder,
    );

  void width;
  return [
    border("┌", "┬", "┐"),
    line(rendered[0], true),
    border("├", "┼", "┤"),
    ...rendered.slice(1).map((r) => line(r, false)),
    border("└", "┴", "┘"),
  ];
}

// markdown source -> styled terminal string (or raw passthrough).
export function render(
  src: string,
  opts: { color: boolean } = { color: true },
): string {
  if (!opts.color) return src.trimEnd() + "\n";
  setColorEnabled(true);

  const width = termWidth();
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const spacer = () => {
    if (out.length && out[out.length - 1] !== "") out.push("");
  };

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      spacer();
      i++;
      continue;
    }

    if (isFence(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !isFence(lines[i])) buf.push(lines[i++]);
      i++;
      spacer();
      out.push(...renderCode(buf));
      spacer();
      continue;
    }

    if (isHr(line)) {
      out.push(style("─".repeat(width), theme.rule));
      i++;
      continue;
    }

    if (isHeading(line)) {
      spacer();
      out.push(...renderHeading(line));
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const buf: string[] = [];
      while (i < lines.length && isTableRow(lines[i]) && !isBlank(lines[i]))
        buf.push(lines[i++]);
      spacer();
      out.push(...renderTable(buf, width));
      spacer();
      continue;
    }

    if (isQuote(line)) {
      const buf: string[] = [];
      while (i < lines.length && isQuote(lines[i])) buf.push(lines[i++]);
      out.push(...renderQuote(buf, width));
      continue;
    }

    if (listMatch(line)) {
      const buf: string[] = [];
      while (
        i < lines.length &&
        (listMatch(lines[i]) ||
          (!isBlank(lines[i]) && /^\s+/.test(lines[i]) && buf.length))
      ) {
        buf.push(lines[i++]);
      }
      out.push(...renderList(buf, width));
      continue;
    }

    // paragraph: gather until a blank or block-starting line
    const buf: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !isFence(lines[i]) &&
      !isHeading(lines[i]) &&
      !isHr(lines[i]) &&
      !isQuote(lines[i]) &&
      !listMatch(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    out.push(...renderParagraph(buf, width));
  }

  while (out.length && out[0] === "") out.shift();
  while (out.length && out[out.length - 1] === "") out.pop();

  return out.join("\n") + "\n";
}
