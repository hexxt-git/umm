// Parsers for the machine-readable print output agents emit when asked for a
// session id. Each throws on malformed input; run.ts falls back to raw stdout.

// claude and cursor-agent share a shape: one JSON object, `.result` +
// `.session_id`. Verified against both.
export function parseResultEnvelope(stdout: string): {
  text: string;
  sessionId?: string;
} {
  const env = JSON.parse(stdout);
  if (env.is_error)
    throw new Error(String(env.result ?? "agent reported an error"));
  if (typeof env.result !== "string") throw new Error("no result in output");
  return {
    text: env.result,
    sessionId: typeof env.session_id === "string" ? env.session_id : undefined,
  };
}

// codex --json emits JSONL events: `thread.started` carries the id that
// `codex resume <id>` accepts, and the answer is the last agent_message.
export function parseCodexEvents(stdout: string): {
  text: string;
  sessionId?: string;
} {
  let sessionId: string | undefined;
  let text: string | undefined;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    let event: {
      type?: string;
      thread_id?: string;
      item?: { type?: string; text?: string };
    };
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (
      event.type === "thread.started" &&
      typeof event.thread_id === "string"
    ) {
      sessionId = event.thread_id;
    } else if (
      event.item?.type === "agent_message" &&
      typeof event.item.text === "string"
    ) {
      text = event.item.text;
    }
  }
  if (text == null) throw new Error("no agent message in output");
  return { text, sessionId };
}

// opencode --format json emits JSONL events, every one tagged with the
// sessionID that `opencode -s <id>` accepts. The answer arrives as whole `text`
// parts (not deltas) — keyed by part id, last write wins, so a streaming
// revision or a second part after tool use both come out right.
export function parseOpencodeEvents(stdout: string): {
  text: string;
  sessionId?: string;
} {
  let sessionId: string | undefined;
  const parts = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    let event: {
      type?: string;
      sessionID?: string;
      part?: { id?: string; text?: string };
    };
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (!sessionId && typeof event.sessionID === "string") {
      sessionId = event.sessionID;
    }
    if (
      event.type === "text" &&
      typeof event.part?.id === "string" &&
      typeof event.part.text === "string"
    ) {
      parts.set(event.part.id, event.part.text);
    }
  }
  if (parts.size === 0) throw new Error("no answer in output");
  return { text: [...parts.values()].join("\n"), sessionId };
}
