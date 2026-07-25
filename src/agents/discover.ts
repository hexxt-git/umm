import { execFileSync } from "node:child_process";
import type { Agent } from "./types.js";

// Returns [] on missing/failing discovery so callers use the agent's default.
export async function discoverModels(agent: Agent): Promise<string[]> {
  if (!agent.listModels) return [];
  try {
    return uniq(await agent.listModels());
  } catch {
    return [];
  }
}

// Runs an agent subcommand that prints one model per line (agy/opencode).
export function runModels(bin: string, args: string[]): string[] {
  const out = execFileSync(bin, args, {
    encoding: "utf8",
    timeout: 8000,
    stdio: ["ignore", "pipe", "ignore"],
  });
  return splitLines(out);
}

function splitLines(s: string): string[] {
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs)];
}
