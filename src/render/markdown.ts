// Block-level markdown -> terminal. Line-based parser; inline styling and
// width-aware wrapping are delegated to inline.ts / width.ts. No HTML.
import { style, sgr, theme, setColorEnabled } from "./ansi.js";
import { renderInline, renderInlineFlat } from "./inline.js";
import { displayWidth, stripAnsi, truncate } from "./width.js";

const MAX_WIDTH = 90;
const MIN_TABLE_CELL_WIDTH = 6;

function termWidth(requested?: number): number {
  const cols = requested ?? process.stdout.columns ?? 80;
  return Math.max(1, Math.min(Math.floor(cols), MAX_WIDTH));
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

function renderHeading(line: string, width: number): string[] {
  const m = /^(#{1,6})\s+(.*)$/.exec(line)!;
  const level = m[1].length;
  const rendered = renderInline(m[2], width);
  const styled = rendered.map((text) => style(text, theme.heading, sgr.bold));
  if (level === 1) {
    const rule = style(
      "─".repeat(
        Math.max(...rendered.map((text) => displayWidth(stripAnsi(text)))),
      ),
      theme.heading,
    );
    return [...styled, rule];
  }
  return styled;
}

function renderParagraph(lines: string[], width: number): string[] {
  return renderInline(lines.join(" "), width);
}

function renderQuote(lines: string[], width: number): string[] {
  const inner = lines.map((l) => l.replace(/^\s*>\s?/, "")).join(" ");
  const bar = width > 2 ? style("│ ", theme.quote) : "";
  return renderInline(inner, width - displayWidth(bar)).map(
    (l) => bar + style(l, sgr.dim),
  );
}

function renderCode(lines: string[]): string[] {
  const bar = style("▏", theme.codeBlock);
  const out = lines.map((l) => `${bar} ${style(l, theme.codeBlock)}`);
  return out;
}

// Nesting is by leading indentation.
function renderList(items: string[], width: number): string[] {
  const out: string[] = [];
  const parsed: { indent: number; marker: string; content: string }[] = [];
  for (const raw of items) {
    const match = listMatch(raw);
    if (match) {
      parsed.push({
        indent: match[1].length,
        marker: match[2],
        content: match[3],
      });
    } else if (parsed.length) {
      parsed[parsed.length - 1].content += ` ${raw.trim()}`;
    }
  }
  for (const { indent, marker, content } of parsed) {
    const depth = Math.floor(indent / 2);
    const pad = "  ".repeat(depth);
    const ordered = /\d/.test(marker);
    const bulletText = ordered ? `${marker} ` : "• ";
    const bullet = style(bulletText, theme.bullet);
    const prefixWidth = displayWidth(pad) + displayWidth(bulletText);
    const showPrefix = prefixWidth < width;
    const firstPrefix = showPrefix ? pad + bullet : "";
    const hang = showPrefix ? pad + " ".repeat(displayWidth(bulletText)) : "";
    const wrapped = renderInline(content, width - displayWidth(firstPrefix));
    wrapped.forEach((l, idx) => {
      out.push(idx === 0 ? firstPrefix + l : hang + l);
    });
  }
  return out;
}

function renderField(
  label: string,
  value: string,
  width: number,
  marker: string,
): string[] {
  const markerText = displayWidth(marker) < width ? marker : "";
  const roomAfterMarker = width - displayWidth(markerText);
  const maxLabel = Math.max(
    0,
    Math.min(Math.floor(width / 3), roomAfterMarker - 2),
  );
  const shownLabel = maxLabel > 0 && label ? truncate(label, maxLabel) : "";
  const renderedLabel = shownLabel
    ? style(renderInlineFlat(shownLabel), sgr.bold)
    : "";
  const prefix =
    markerText +
    (renderedLabel ? `${renderedLabel}${style(":", sgr.dim)} ` : "");
  const prefixWidth = displayWidth(prefix);
  const wrapped = renderInline(value, width - prefixWidth);
  const hang = " ".repeat(prefixWidth);
  return wrapped.map((line, i) => (i === 0 ? prefix + line : hang + line));
}

function renderTableFallback(
  header: string[],
  body: string[][],
  width: number,
): string[] {
  const out: string[] = [];
  const rowHeadings = header[0] === "" && header.slice(1).some(Boolean);
  for (const [rowIndex, row] of body.entries()) {
    if (rowIndex > 0) out.push("");
    if (rowHeadings) {
      out.push(
        ...renderInline(row[0] ?? "", width).map((line) =>
          style(line, theme.accent, sgr.bold),
        ),
      );
      for (let i = 1; i < header.length; i++) {
        out.push(...renderField(header[i], row[i] ?? "", width, "  "));
      }
    } else {
      for (let i = 0; i < header.length; i++) {
        out.push(
          ...renderField(header[i], row[i] ?? "", width, i === 0 ? "• " : "  "),
        );
      }
    }
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

  const naturalWidths = Array.from({ length: cols }, (_, i) =>
    Math.max(...rendered.map((r) => displayWidth(r[i]))),
  );
  const available = width - 3 * cols - 1;
  let widths = naturalWidths;

  if (naturalWidths.reduce((sum, cell) => sum + cell, 0) > available) {
    widths = naturalWidths.map((cell) => Math.min(cell, MIN_TABLE_CELL_WIDTH));
    let remaining = available - widths.reduce((sum, cell) => sum + cell, 0);
    if (remaining < 0) return renderTableFallback(header, body, width);

    while (remaining > 0) {
      let grew = false;
      for (let i = 0; i < cols && remaining > 0; i++) {
        if (widths[i] < naturalWidths[i]) {
          widths[i]++;
          remaining--;
          grew = true;
        }
      }
      if (!grew) break;
    }
  }

  const V = style("│", theme.tableBorder);
  const lines = (cells: string[], bold: boolean) => {
    const wrapped = Array.from({ length: cols }, (_, i) =>
      renderInline(cells[i] ?? "", widths[i]),
    );
    const height = Math.max(...wrapped.map((cell) => cell.length));
    return Array.from(
      { length: height },
      (_, row) =>
        V +
        wrapped
          .map((cell, i) => {
            const content = cell[row] ?? "";
            const shown = bold ? style(content, sgr.bold) : content;
            return " " + padTo(shown, widths[i]) + " ";
          })
          .join(V) +
        V,
    );
  };

  const border = (l: string, m: string, r: string) =>
    style(
      l + widths.map((w) => "─".repeat(w + 2)).join(m) + r,
      theme.tableBorder,
    );

  return [
    border("┌", "┬", "┐"),
    ...lines(header, true),
    border("├", "┼", "┤"),
    ...body.flatMap((row) => lines(row, false)),
    border("└", "┴", "┘"),
  ];
}

// markdown source -> styled terminal string (or raw passthrough).
export function render(
  src: string,
  opts: { color: boolean; width?: number } = { color: true },
): string {
  if (!opts.color) return src.trimEnd() + "\n";
  setColorEnabled(true);

  const width = termWidth(opts.width);
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
      out.push(...renderHeading(line, width));
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
