// Dependency-free raw-mode select, drawn to stderr. Shared by the config
// wizard and the history picker.
import { emitKeypressEvents } from "node:readline";
import { style, sgr, theme } from "./render/ansi.js";

export interface Choice<T> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

// Cap visible options; long lists (cursor has hundreds of models) scroll.
const MAX_PICKER_ROWS = 12;

// Single-select list: arrows/jk move, Enter confirms, Ctrl-C/Esc aborts.
// Labels must be one screen line each — the redraw rewinds by line count, so a
// soft-wrapped label corrupts it. Truncate before calling.
export function select<T>(
  title: string,
  choices: Choice<T>[],
  initial: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const out = process.stderr;
    let idx = Math.max(0, initial);

    emitKeypressEvents(process.stdin);
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    const rows = process.stdout.rows || 24;
    // Never exceed choices.length — the floor of 3 is only there to keep a
    // usable scroll window on a short terminal, not to pad the list out.
    const visible = Math.min(
      choices.length,
      MAX_PICKER_ROWS,
      Math.max(3, rows - 4),
    );
    let start = 0;
    let prevLines = 0;

    const draw = (first: boolean) => {
      if (idx < start) start = idx;
      else if (idx >= start + visible) start = idx - visible + 1;
      start = Math.max(0, Math.min(start, choices.length - visible));

      if (!first) out.write(`\x1b[${prevLines}A`);
      out.write(`\x1b[J`);

      const lines: string[] = [style(title, sgr.bold)];
      if (start > 0) lines.push(style(`  ↑ ${start} more`, sgr.dim));
      for (let i = start; i < start + visible; i++) {
        const c = choices[i];
        const cursor = i === idx ? style("❯ ", theme.accent) : "  ";
        let label = c.label;
        if (c.disabled) label = style(label, sgr.dim);
        else if (i === idx) label = style(label, theme.accent);
        const hint = c.hint ? " " + style(c.hint, sgr.dim) : "";
        lines.push(`${cursor}${label}${hint}`);
      }
      const below = choices.length - (start + visible);
      if (below > 0) lines.push(style(`  ↓ ${below} more`, sgr.dim));

      out.write(lines.join("\n") + "\n");
      prevLines = lines.length;
    };

    const cleanup = () => {
      process.stdin.removeListener("keypress", onKey);
      if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
    };

    const onKey = (_str: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        out.write("\n");
        reject(new Error("cancelled"));
        return;
      }
      if (key.name === "escape") {
        cleanup();
        reject(new Error("cancelled"));
        return;
      }
      if (key.name === "up" || key.name === "k") {
        idx = (idx - 1 + choices.length) % choices.length;
        draw(false);
      } else if (key.name === "down" || key.name === "j") {
        idx = (idx + 1) % choices.length;
        draw(false);
      } else if (key.name === "return") {
        if (choices[idx].disabled) return;
        cleanup();
        out.write("\n");
        resolve(choices[idx].value);
      }
    };

    process.stdin.on("keypress", onKey);
    // The listener and raw mode are already live, so a failed first draw must
    // restore the terminal instead of leaving it raw with a dangling listener.
    try {
      draw(true);
    } catch (err) {
      cleanup();
      reject(err as Error);
    }
  });
}

// Single-keypress y/N. Anything but y/Y is no.
export function confirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const out = process.stderr;
    emitKeypressEvents(process.stdin);
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    out.write(`${question} ${style("[y/N]", sgr.dim)} `);

    const onKey = (str: string, key: { name?: string; ctrl?: boolean }) => {
      process.stdin.removeListener("keypress", onKey);
      if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      out.write("\n");
      resolve(!key.ctrl && (str === "y" || str === "Y"));
    };

    process.stdin.on("keypress", onKey);
  });
}
