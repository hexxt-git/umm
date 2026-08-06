// Config persistence at $XDG_CONFIG_HOME/umm/config.json (falls back to
// ~/.config/umm/config.json). JSON to stay dependency-free.
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parsePersistedJson, writeFileAtomic } from "./persist.js";

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

const LENGTHS: Record<string, Length> = {
  brief: "brief",
  short: "brief",
  standard: "standard",
  normal: "standard",
  medium: "standard",
  full: "full",
  long: "full",
  detailed: "full",
};

const SOURCES: Record<string, Sources> = {
  on: "on",
  yes: "on",
  true: "on",
  off: "off",
  no: "off",
  false: "off",
};

function normalizedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}

export function normalizeLength(
  value: unknown,
  fallback: Length = DEFAULTS.length,
): Length {
  const key = normalizedString(value)?.toLowerCase();
  return (key && LENGTHS[key]) || fallback;
}

export function normalizeSources(
  value: unknown,
  fallback: Sources = DEFAULTS.sources,
): Sources {
  if (typeof value === "boolean") return value ? "on" : "off";
  const key = normalizedString(value)?.toLowerCase();
  return (key && SOURCES[key]) || fallback;
}

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
    const raw = parsePersistedJson(readFileSync(configPath(), "utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ...DEFAULTS };
    }
    const values = raw as Record<string, unknown>;
    const agent = normalizedString(values.agent)?.toLowerCase();
    const model = normalizedString(values.model);
    return {
      agent: agent ?? DEFAULTS.agent,
      length: normalizeLength(values.length),
      sources: normalizeSources(values.sources),
      ...(model ? { model } : {}),
    };
  } catch {
    // corrupt config should not brick the tool
    return { ...DEFAULTS };
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileAtomic(configPath(), JSON.stringify(config, null, 2) + "\n");
}
