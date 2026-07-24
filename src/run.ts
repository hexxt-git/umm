// Builds the prompt from the embedded skill + config, spawns the chosen agent,
// and returns its raw markdown output. No fallback: if the agent fails, we
// surface the error and exit. That is a deliberate scope decision.
import { spawn } from "node:child_process";
import type { Agent } from "./agents.js";
import type { Config } from "./config.js";
import { SKILL } from "./skill.generated.js";

// Assembles skill body + a Configuration block reflecting the user's settings +
// the query, in the same shape the validation harness proved out.
export function buildPrompt(query: string, config: Config): string {
  const configBlock = [
    "## Configuration",
    `- length: ${config.length}`,
    `- sources: ${config.sources}`,
  ].join("\n");

  return `${SKILL}\n\n${configBlock}\n\n---\n\numm ${query}`;
}

// Spawns the agent, writing the prompt to stdin, and resolves with stdout.
// Rejects with a descriptive error on non-zero exit or spawn failure.
export function runAgent(agent: Agent, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(agent.bin, agent.args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(new Error(`${agent.name} is not installed (${agent.bin} not found on PATH)`));
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

    child.stdin.write(prompt);
    child.stdin.end();
  });
}
