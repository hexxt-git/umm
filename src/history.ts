// Ask/answer log at $XDG_STATE_HOME/umm/history.jsonl (falls back to
// ~/.local/state/umm/). State, not config: the XDG spec names this directory
// for "actions history", and it must not ride along in synced dotfiles.
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Length, Sources } from "./config.js";

export interface HistoryEntry {
  id: string;
  ts: string;
  agent: string; // AGENTS key, not display name
  model?: string;
  // Only when the agent exposed one; absent ⇒ continue reseeds instead.
  sessionId?: string;
  cwd: string;
  length: Length;
  sources: Sources;
  question: string;
  answer: string; // raw markdown, pre-render
}

// ~1.4KB an entry, so the whole file stays under a megabyte.
const MAX_ENTRIES = 500;

export function historyDir(): string {
  const base = process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  return join(base, "umm");
}

export function historyPath(): string {
  return join(historyDir(), "history.jsonl");
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Oldest first. Unparseable lines are skipped: one torn write costs that
// entry, never the file.
export function readHistory(): HistoryEntry[] {
  const path = historyPath();
  if (!existsSync(path)) return [];
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const entries: HistoryEntry[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (typeof entry?.question === "string") entries.push(entry);
    } catch {
      // skip
    }
  }
  return entries;
}

// Rewrites the file capped to the newest MAX_ENTRIES. Via temp + rename, so an
// interrupted write can't leave a truncated history behind.
export function appendEntry(entry: HistoryEntry): void {
  try {
    const kept = [...readHistory(), entry].slice(-MAX_ENTRIES);
    const body = kept.map((e) => JSON.stringify(e)).join("\n") + "\n";
    mkdirSync(historyDir(), { recursive: true });
    const tmp = historyPath() + ".tmp";
    writeFileSync(tmp, body);
    renameSync(tmp, historyPath());
  } catch {
    // history is a convenience; never fail an answer over it
  }
}
