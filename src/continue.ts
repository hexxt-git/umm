// `umm continue` — reopens a past answer in a real interactive agent session.
// Deliberately drops SKILL/CLI_ADDENDUM: this is the plain agent, which is
// exactly what cli.md tells users to go run themselves.
import { existsSync } from "node:fs";
import { AGENTS } from "./agents/index.js";
import { isInstalled } from "./agents/registry.js";
import type { Agent } from "./agents/types.js";
import { loadConfig } from "./config.js";
import { readHistory, type HistoryEntry } from "./history.js";
import { handOff } from "./run.js";
import { select, confirm, type Choice } from "./select.js";
import { style, sgr, theme } from "./render/ansi.js";
import { truncate, padTo, displayWidth } from "./render/width.js";

function relTime(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const units: [number, string][] = [
    [60, "m"],
    [3600, "h"],
    [86400, "d"],
  ];
  for (let i = units.length - 1; i >= 0; i--) {
    const [size, suffix] = units[i];
    if (secs >= size) return `${Math.floor(secs / size)}${suffix} ago`;
  }
  return "just now";
}

function agentName(id: string): string {
  return AGENTS[id]?.name ?? id;
}

// By timestamp, not file order: a hand-edited or out-of-order file would
// otherwise make "the last answer" the wrong one.
function byNewest(entries: HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
  );
}

// One screen line per row, so the picker's redraw stays correct: questions are
// truncated to whatever the hints leave over, then padded so hints align.
async function pickEntry(entries: HistoryEntry[]): Promise<HistoryEntry> {
  const newest = byNewest(entries);
  const hints = newest.map(
    (e) => `${relTime(e.ts)} · ${agentName(e.agent).toLowerCase()}`,
  );
  const hintWidth = Math.max(...hints.map(displayWidth));
  const columns = process.stdout.columns || 80;
  const labelWidth = Math.max(16, columns - hintWidth - 5);

  const choices: Choice<HistoryEntry>[] = newest.map((entry, i) => ({
    value: entry,
    label: padTo(truncate(entry.question, labelWidth), labelWidth),
    hint: hints[i],
  }));
  return select("Continue which answer?", choices, 0);
}

function seedPrompt(entry: HistoryEntry): string {
  const indent = (s: string) =>
    s
      .split("\n")
      .map((l) => "  " + l)
      .join("\n");
  return [
    "Earlier I asked:",
    indent(entry.question),
    "",
    "You answered:",
    indent(entry.answer),
    "",
    "Continue from here.",
  ].join("\n");
}

// Native resume where the agent gave us an id, reseed otherwise. A resume that
// exits non-zero falls back to reseed: an untested flag costs session
// fidelity, never the feature.
async function open(
  agent: Agent,
  entry: HistoryEntry,
  cwd: string,
): Promise<number> {
  const modelArgs =
    entry.model && agent.modelFlag ? [agent.modelFlag, entry.model] : [];
  const prompt = seedPrompt(entry);
  const reseed = () =>
    handOff(
      agent,
      [...modelArgs, ...(agent.seedArgs?.(prompt) ?? [prompt])],
      cwd,
    );

  if (agent.resume && entry.sessionId) {
    // Model is not re-passed: the session already has one.
    const code = await handOff(agent, agent.resume.args(entry.sessionId), cwd);
    if (code === 0) return code;
    process.stderr.write(
      style(`umm: could not resume that session — reseeding.\n`, sgr.dim),
    );
  }
  return reseed();
}

export async function runContinue(pick: boolean): Promise<number> {
  const out = process.stderr;

  if (!process.stdin.isTTY) {
    out.write("umm: continue needs an interactive terminal.\n");
    return 1;
  }

  const entries = readHistory();
  if (entries.length === 0) {
    out.write("umm: no history yet.\n");
    return 0;
  }

  let entry: HistoryEntry;
  if (pick) {
    try {
      entry = await pickEntry(entries);
    } catch (err) {
      // Only Ctrl-C/Esc is a cancellation; don't hide a real failure as one.
      const message = (err as Error).message;
      out.write(
        message === "cancelled"
          ? style("cancelled.\n", sgr.dim)
          : `umm: ${message}\n`,
      );
      return 1;
    }
  } else {
    entry = byNewest(entries)[0];
  }

  let agent = AGENTS[entry.agent];
  if (!agent || !isInstalled(agent)) {
    const missing = agentName(entry.agent);
    const fallback = AGENTS[loadConfig().agent];
    if (!fallback || !isInstalled(fallback)) {
      out.write(
        `umm: that answer came from ${missing}, which is not installed.\n`,
      );
      return 1;
    }
    out.write(`umm: ${missing} is not installed.\n`);
    if (!(await confirm(`  continue in ${fallback.name} instead?`))) return 1;
    // A different agent never saw the session, so this is a reseed by force.
    agent = fallback;
    entry = { ...entry, sessionId: undefined };
  }

  // Answers are often about the directory they were asked in, and umm is a
  // global tool — land back where the question was asked.
  let cwd = entry.cwd;
  if (!existsSync(cwd)) {
    out.write(
      style(`umm: ${cwd} is gone — using the current directory.\n`, sgr.dim),
    );
    cwd = process.cwd();
  }

  out.write(
    style("→ ", theme.accent) + style(`${agent.name} in ${cwd}\n`, sgr.dim),
  );
  return handOffOrFail(agent, entry, cwd, out);
}

async function handOffOrFail(
  agent: Agent,
  entry: HistoryEntry,
  cwd: string,
  out: NodeJS.WriteStream,
): Promise<number> {
  try {
    return await open(agent, entry, cwd);
  } catch (err) {
    out.write(`umm: ${(err as Error).message}\n`);
    return 1;
  }
}
