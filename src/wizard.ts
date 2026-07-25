// Interactive config wizard, built on the shared raw-mode select.
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
import { select, type Choice } from "./select.js";

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
