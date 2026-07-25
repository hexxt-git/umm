import { spawn } from "node:child_process";
import type { Agent } from "./agents/types.js";
import type { Config } from "./config.js";
import { SKILL, CLI_ADDENDUM } from "./skill.generated.js";

export function buildPrompt(query: string, config: Config): string {
  const configBlock = [
    "## Configuration",
    `- length: ${config.length}`,
    `- sources: ${config.sources}`,
  ].join("\n");

  return `${SKILL}\n\n${CLI_ADDENDUM}\n\n${configBlock}\n\n---\n\numm ${query}`;
}

// Spawns the agent, delivers the prompt per its `input` mode, resolves stdout.
// No fallback by design: on failure, reject.
export function runAgent(
  agent: Agent,
  prompt: string,
  model?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const modelArgs = model && agent.modelFlag ? [agent.modelFlag, model] : [];
    const baseArgs = [...agent.args, ...modelArgs];
    const args = agent.input === "arg" ? [...baseArgs, prompt] : baseArgs;
    const child = spawn(agent.bin, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            `${agent.name} is not installed (${agent.bin} not found on PATH)`,
          ),
        );
      } else {
        reject(new Error(`could not start ${agent.bin}: ${err.message}`));
      }
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const detail = stderr.trim() || stdout.trim() || `exit code ${code}`;
        reject(new Error(`${agent.name} failed: ${detail}`));
      }
    });

    if (agent.input === "stdin") {
      child.stdin.write(prompt);
    }
    child.stdin.end();
  });
}
