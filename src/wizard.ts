// Interactive config wizard. Dependency-free: raw-mode stdin, arrow-key select,
// rendered to stderr so it never interferes with piped stdout. Covers the three
// settings the skill and CLI read — agent, answer length, sources — and shows
// which agents are actually installed.
import { emitKeypressEvents } from "node:readline";
import { AGENTS, listAgents } from "./agents.js";
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

// Renders a single-select list and resolves with the chosen value. Arrow keys
// or j/k move, Enter confirms, Ctrl-C / Esc aborts. Disabled rows are skippable
// only in that they can't be selected.
function select<T>(title: string, choices: Choice<T>[], initial: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const out = process.stderr;
    let idx = Math.max(0, initial);

    emitKeypressEvents(process.stdin);
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    const draw = (first: boolean) => {
      if (!first) out.write(`\x1b[${choices.length + 1}A`);
      out.write(`\x1b[J`);
      out.write(style(title, sgr.bold) + "\n");
      choices.forEach((c, i) => {
        const cursor = i === idx ? style("❯ ", theme.accent) : "  ";
        let label = c.label;
        if (c.disabled) label = style(label, sgr.dim);
        else if (i === idx) label = style(label, theme.accent);
        const hint = c.hint ? " " + style(c.hint, sgr.dim) : "";
        out.write(`${cursor}${label}${hint}\n`);
      });
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
    draw(true);
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
  agentChoices.sort((a, b) => Number(!!b.hint?.includes("installed")) - Number(!!a.hint?.includes("installed")));

  const agentInitial = Math.max(
    0,
    agentChoices.findIndex((c) => c.value === current.agent && !c.disabled),
  );

  let config: Config;
  try {
    const agent = await select("Which agent should umm use?", agentChoices, agentInitial);

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

    config = { agent, length, sources };
  } catch {
    out.write(style("cancelled — nothing saved.\n", sgr.dim));
    process.exit(1);
  }

  saveConfig(config);
  out.write(
    "\n" +
      style("saved", theme.accent) +
      style(` → ${configPath()}\n`, sgr.dim) +
      style(`  agent: ${AGENTS[config.agent].name}\n`, sgr.dim) +
      style(`  length: ${config.length}   sources: ${config.sources}\n`, sgr.dim),
  );
}
