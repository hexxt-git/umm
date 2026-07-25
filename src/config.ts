// Config persistence at $XDG_CONFIG_HOME/umm/config.json (falls back to
// ~/.config/umm/config.json). JSON to stay dependency-free.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Length = "brief" | "standard" | "full";
export type Sources = "on" | "off";

export interface Config {
  agent: string;
  length: Length;
  sources: Sources;
  // Absent ⇒ let the agent pick its default.
  model?: string;
}

export const DEFAULTS: Config = {
  agent: "claude",
  length: "standard",
  sources: "on",
};

export function configDir(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "umm");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

export function configExists(): boolean {
  return existsSync(configPath());
}

export function loadConfig(): Config {
  if (!configExists()) return { ...DEFAULTS };
  try {
    const raw = JSON.parse(readFileSync(configPath(), "utf8"));
    return { ...DEFAULTS, ...raw };
  } catch {
    // corrupt config should not brick the tool
    return { ...DEFAULTS };
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(config, null, 2) + "\n");
}
