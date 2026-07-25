#!/usr/bin/env node
import { AGENTS } from "./agents/index.js";
import { loadConfig, configExists } from "./config.js";
import { buildPrompt, runAgent } from "./run.js";
import { render } from "./render/markdown.js";
import { startSpinner } from "./spinner.js";
import { runWizard } from "./wizard.js";

// Color only on a real TTY; piped/redirected output stays clean markdown.
function useColor(): boolean {
  return (
    !!process.stdout.isTTY &&
    process.env.NO_COLOR == null &&
    process.env.TERM !== "dumb"
  );
}

function fail(msg: string): never {
  process.stderr.write(`umm: ${msg}\n`);
  process.exit(1);
}

async function answer(query: string, raw: boolean): Promise<void> {
  const config = loadConfig();
  const agent = AGENTS[config.agent];
  if (!agent) {
    fail(`unknown agent "${config.agent}". run 'umm --config' to pick one.`);
  }

  const prompt = buildPrompt(query, config);
  const spinner = startSpinner();
  let output: string;
  try {
    output = await runAgent(agent, prompt, config.model);
  } catch (err) {
    spinner.stop();
    fail((err as Error).message);
  } finally {
    spinner.stop();
  }

  const color = !raw && useColor();
  process.stdout.write(render(output, { color }));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    if (!configExists()) {
      await runWizard();
    } else {
      process.stderr.write("usage: umm <your question>\n");
    }
    process.exit(0);
  }

  // Only argv[0] is eligible to be a flag, so `umm what does --force do` works.
  const head = argv[0];
  let raw = false;
  let rest = argv;

  if (head === "--config" || (head === "config" && argv.length === 1)) {
    await runWizard();
    process.exit(0);
  } else if (head === "--raw") {
    raw = true;
    rest = argv.slice(1);
  }

  if (rest.length === 0) fail("no question given");

  await answer(rest.join(" "), raw);
}

main();
