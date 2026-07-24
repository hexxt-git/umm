#!/usr/bin/env node
// umm — a faster way to ask.
//
// Arg parsing rule: only argv[0] may be a known flag. Everything else is the
// query, verbatim. This is what lets `umm what does --force do` work: --force
// is not in position 0, so it stays part of the question.
import { AGENTS } from "./agents.js";
import { loadConfig, configExists } from "./config.js";
import { buildPrompt, runAgent } from "./run.js";
import { render } from "./render/markdown.js";
import { startSpinner } from "./spinner.js";
import { runWizard } from "./wizard.js";

// Color/formatting only when writing to a real terminal. Piped or redirected
// output (umm x | pbcopy, umm x > notes.md) gets clean raw markdown, and
// NO_COLOR / TERM=dumb are honored. This is also what --raw forces.
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
    output = await runAgent(agent, prompt);
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

  // No args: first run -> wizard; otherwise a short usage line.
  if (argv.length === 0) {
    if (!configExists()) {
      await runWizard();
    } else {
      process.stderr.write("usage: umm <your question>\n");
    }
    process.exit(0);
  }

  // Only position 0 is eligible to be a flag.
  const head = argv[0];
  let raw = false;
  let rest = argv;

  if (head === "--config") {
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
