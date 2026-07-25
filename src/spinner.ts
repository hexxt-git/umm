// Elapsed-time spinner shown while the agent buffers its output. Writes to
// stderr only (keeps `umm x | pbcopy` clean) and no-ops when stderr isn't a TTY.
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface Spinner {
  stop: () => void;
}

export function startSpinner(label = "thinking"): Spinner {
  if (!process.stderr.isTTY || process.env.NO_COLOR != null) {
    return { stop: () => {} };
  }

  const start = Date.now();
  let frame = 0;
  process.stderr.write("\x1b[?25l"); // hide cursor

  const tick = () => {
    const secs = ((Date.now() - start) / 1000).toFixed(0);
    const f = FRAMES[frame++ % FRAMES.length];
    process.stderr.write(`\r\x1b[2m${f} ${label}… ${secs}s\x1b[22m\x1b[K`);
  };
  tick();
  const timer = setInterval(tick, 80);

  return {
    stop() {
      clearInterval(timer);
      process.stderr.write("\r\x1b[K\x1b[?25h"); // clear line, show cursor
    },
  };
}
