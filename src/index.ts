#!/usr/bin/env node
import { AGENTS } from "./agents/index.js";
import { loadConfig, configExists } from "./config.js";
import { buildPrompt, runAgent, type AgentResult } from "./run.js";
import { appendEntry, newId } from "./history.js";
import { runContinue } from "./continue.js";
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
  let result: AgentResult;
  try {
    result = await runAgent(agent, prompt, config.model);
  } catch (err) {
    spinner.stop();
    fail((err as Error).message);
  } finally {
    spinner.stop();
  }

  // Successful answers only — `umm continue` has nothing to reopen otherwise.
  appendEntry({
    id: newId(),
    ts: new Date().toISOString(),
    agent: config.agent,
    ...(config.model ? { model: config.model } : {}),
    ...(result.sessionId ? { sessionId: result.sessionId } : {}),
    cwd: process.cwd(),
    length: config.length,
    sources: config.sources,
    question: query,
    answer: result.text,
  });

  const color = !raw && useColor();
  process.stdout.write(render(result.text, { color }));
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

  // Only bare `continue` (optionally with --pick) is the command, so real
  // questions like `umm continue vs break` still pass through.
  if (
    head === "continue" &&
    (argv.length === 1 || (argv.length === 2 && argv[1] === "--pick"))
  ) {
    process.exit(await runContinue(argv[1] === "--pick"));
  }

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
