// Config persistence. JSON (not TOML) because neither Node nor Bun parses TOML
// without a dependency, and we are keeping this dependency-free. Lives at
// $XDG_CONFIG_HOME/umm/config.json, falling back to ~/.config/umm/config.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Length = "brief" | "standard" | "full";
export type Sources = "on" | "off";

export interface Config {
  agent: string;
  length: Length;
  sources: Sources;
  // Empty/absent ⇒ let the agent pick its default. Only ever a name the agent
  // itself reported (see agents/discover.ts), so it stays valid.
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
    // corrupt config should not brick the tool; fall back to defaults
    return { ...DEFAULTS };
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(config, null, 2) + "\n");
}
