import { spawn } from "node:child_process";
import type { Agent } from "./agents/types.js";
import type { Config } from "./config.js";
import { SKILL, CLI_ADDENDUM } from "./skill.generated.js";

export interface AgentResult {
  text: string;
  // Absent when the agent exposes no id; continue reseeds instead.
  sessionId?: string;
}

export function buildPrompt(query: string, config: Config): string {
  const configBlock = [
    "## Configuration",
    `- length: ${config.length}`,
    `- sources: ${config.sources}`,
  ].join("\n");

  return `${SKILL}\n\n${CLI_ADDENDUM}\n\n${configBlock}\n\n---\n\numm ${query}`;
}

function notInstalled(agent: Agent): Error {
  return new Error(
    `${agent.name} is not installed (${agent.bin} not found on PATH)`,
  );
}

// Spawns the agent, delivers the prompt per its `input` mode, resolves its
// answer. No fallback by design: on failure, reject.
export function runAgent(
  agent: Agent,
  prompt: string,
  model?: string,
): Promise<AgentResult> {
  return new Promise((resolve, reject) => {
    const modelArgs = model && agent.modelFlag ? [agent.modelFlag, model] : [];
    const effortArgs = agent.effortArgs ?? [];
    const printArgs = agent.resume?.printArgs ?? [];
    const flags = [...printArgs, ...modelArgs, ...effortArgs];
    const baseArgs = agent.flagsFirst
      ? [...flags, ...agent.args]
      : [...agent.args, ...flags];
    const args = agent.input === "arg" ? [...baseArgs, prompt] : baseArgs;
    const child = spawn(agent.bin, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") reject(notInstalled(agent));
      else reject(new Error(`could not start ${agent.bin}: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const detail = stderr.trim() || stdout.trim() || `exit code ${code}`;
        reject(new Error(`${agent.name} failed: ${detail}`));
        return;
      }
      const raw = stdout.trim();
      if (!agent.resume) {
        resolve({ text: raw });
        return;
      }
      try {
        const parsed = agent.resume.parse(raw);
        resolve({ text: parsed.text.trim(), sessionId: parsed.sessionId });
      } catch (err) {
        reject(new Error(`${agent.name} failed: ${(err as Error).message}`));
      }
    });

    if (agent.input === "stdin") {
      child.stdin.write(prompt);
    }
    child.stdin.end();
  });
}

// Hands the terminal to the agent for a real interactive session and waits for
// it to exit. Reasoning effort is deliberately not forced here — a continued
// session is no longer a quick lookup.
export function handOff(
  agent: Agent,
  args: string[],
  cwd: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(agent.bin, args, { stdio: "inherit", cwd });
    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") reject(notInstalled(agent));
      else reject(new Error(`could not start ${agent.bin}: ${err.message}`));
    });
    child.on("close", (code) => resolve(code ?? 0));
  });
}
