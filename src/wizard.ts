// Interactive config wizard: dependency-free raw-mode select, drawn to stderr.
import { emitKeypressEvents } from "node:readline";
import { AGENTS } from "./agents/index.js";
import { listAgents } from "./agents/registry.js";
import { discoverModels } from "./agents/discover.js";
import {
  loadConfig,
  saveConfig,
  configPath,
  type Config,
  type Length,
  type Sources,
} from "./config.js";
import { style, sgr, theme } from "./render/ansi.js";

interface Choice<T> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

// Cap visible options; long lists (cursor has hundreds of models) scroll.
const MAX_PICKER_ROWS = 12;

// Single-select list: arrows/jk move, Enter confirms, Ctrl-C/Esc aborts.
function select<T>(
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

export async function runWizard(): Promise<void> {
  const current = loadConfig();
  const out = process.stderr;

  if (!process.stdin.isTTY) {
    out.write("umm: --config needs an interactive terminal.\n");
    process.exit(1);
  }

  out.write(style("umm setup", theme.heading, sgr.bold) + "\n\n");

  const agents = listAgents();
  const agentChoices: Choice<string>[] = agents.map((a) => ({
    value: a.id,
    label: a.name,
    hint: a.installed ? style("✓ installed", theme.accent) : "not found",
    disabled: !a.installed,
  }));
  // installed agents first, so the default cursor lands on a usable one
  agentChoices.sort(
    (a, b) =>
      Number(!!b.hint?.includes("installed")) -
      Number(!!a.hint?.includes("installed")),
  );

  const agentInitial = Math.max(
    0,
    agentChoices.findIndex((c) => c.value === current.agent && !c.disabled),
  );

  let config: Config;
  try {
    const agent = await select(
      "Which agent should umm use?",
      agentChoices,
      agentInitial,
    );

    // Model list comes from the agent itself; skipped when it exposes none.
    out.write(style("  detecting models…", sgr.dim));
    const models = await discoverModels(AGENTS[agent]);
    out.write("\r\x1b[K");
    let model: string | undefined;
    if (models.length) {
      const modelChoices: Choice<string>[] = [
        { value: "", label: "Default", hint: "agent's own default" },
        ...models.map((m) => ({ value: m, label: m })),
      ];
      const modelInitial = Math.max(
        0,
        modelChoices.findIndex((c) => c.value === (current.model ?? "")),
      );
      model =
        (await select(
          "Which model should it use?",
          modelChoices,
          modelInitial,
        )) || undefined;
    }

    const length = await select<Length>(
      "How long should answers be?",
      [
        { value: "brief", label: "Brief", hint: "~5 lines" },
        { value: "standard", label: "Standard", hint: "~20 lines" },
        { value: "full", label: "Full", hint: "no limit" },
      ],
      ["brief", "standard", "full"].indexOf(current.length),
    );

    const sources = await select<Sources>(
      "Show sources when the answer comes from the web?",
      [
        { value: "on", label: "On", hint: "cite domains" },
        { value: "off", label: "Off" },
      ],
      ["on", "off"].indexOf(current.sources),
    );

    config = { agent, length, sources, ...(model ? { model } : {}) };
  } catch (err) {
    // Only Ctrl-C/Esc is a cancellation; anything else is a real failure and
    // must say so rather than hide behind "cancelled".
    const message = (err as Error).message;
    out.write(
      message === "cancelled"
        ? style("cancelled — nothing saved.\n", sgr.dim)
        : `umm: setup failed — ${message}\n`,
    );
    process.exit(1);
  }

  saveConfig(config);
  out.write(
    "\n" +
      style("saved", theme.accent) +
      style(` → ${configPath()}\n`, sgr.dim) +
      style(`  agent: ${AGENTS[config.agent].name}`, sgr.dim) +
      style(config.model ? `   model: ${config.model}\n` : "\n", sgr.dim) +
      style(
        `  length: ${config.length}   sources: ${config.sources}\n`,
        sgr.dim,
      ),
  );
}
