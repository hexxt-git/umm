// Ask/answer log at $XDG_STATE_HOME/umm/history.jsonl (falls back to
// ~/.local/state/umm/). State, not config: the XDG spec names this directory
// for "actions history", and it must not ride along in synced dotfiles.
import {
  readFileSync,
  mkdirSync,
  existsSync,
  openSync,
  closeSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DEFAULTS,
  normalizeLength,
  normalizeSources,
  type Length,
  type Sources,
} from "./config.js";
import { parsePersistedJson, writeFileAtomic } from "./persist.js";

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
const LOCK_RETRIES = 80;
const LOCK_WAIT_MS = 25;
const STALE_LOCK_MS = 30_000;

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

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeEntry(value: unknown, index: number): HistoryEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const question = optionalString(raw.question) ?? optionalString(raw.query);
  if (!question) return null;

  const rawDate =
    typeof raw.ts === "string" || typeof raw.ts === "number"
      ? new Date(raw.ts)
      : null;
  const ts =
    rawDate && !Number.isNaN(rawDate.getTime())
      ? rawDate.toISOString()
      : new Date(index).toISOString();
  const answerValue = raw.answer ?? raw.result ?? raw.output;
  const answer = typeof answerValue === "string" ? answerValue : "";

  return {
    id: optionalString(raw.id) ?? `recovered-${index}`,
    ts,
    agent: optionalString(raw.agent)?.toLowerCase() ?? DEFAULTS.agent,
    ...(optionalString(raw.model) ? { model: optionalString(raw.model) } : {}),
    ...(optionalString(raw.sessionId)
      ? { sessionId: optionalString(raw.sessionId) }
      : {}),
    cwd: optionalString(raw.cwd) ?? process.cwd(),
    length: normalizeLength(raw.length),
    sources: normalizeSources(raw.sources),
    question,
    answer,
  };
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
  for (const [index, line] of raw.split("\n").entries()) {
    if (!line.trim()) continue;
    const entry = normalizeEntry(parsePersistedJson(line), index);
    if (entry) entries.push(entry);
  }
  return entries;
}

// Rewrites the file capped to the newest MAX_ENTRIES. Via temp + rename, so an
// interrupted write can't leave a truncated history behind.
function waitForLock(): number {
  const lock = historyPath() + ".lock";
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt++) {
    try {
      return openSync(lock, "wx", 0o600);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      try {
        if (Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS) {
          unlinkSync(lock);
          continue;
        }
      } catch {}
      Atomics.wait(
        new Int32Array(new SharedArrayBuffer(4)),
        0,
        0,
        LOCK_WAIT_MS,
      );
    }
  }
  throw new Error("history is busy");
}

export function appendEntry(entry: HistoryEntry): void {
  let lock: number | undefined;
  try {
    mkdirSync(historyDir(), { recursive: true });
    lock = waitForLock();
    const kept = [...readHistory(), entry].slice(-MAX_ENTRIES);
    const body = kept.map((e) => JSON.stringify(e)).join("\n") + "\n";
    writeFileAtomic(historyPath(), body);
  } catch {
    // history is a convenience; never fail an answer over it
  } finally {
    if (lock !== undefined) {
      try {
        closeSync(lock);
      } catch {}
      try {
        unlinkSync(historyPath() + ".lock");
      } catch {}
    }
  }
}
