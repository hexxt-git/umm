import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCodexEvents,
  parseOpencodeEvents,
  parseResultEnvelope,
} from "../dist-npm/agents/session.js";

test("result envelopes expose the answer and optional session", () => {
  assert.deepEqual(
    parseResultEnvelope(
      JSON.stringify({ result: "answer", session_id: "session-1" }),
    ),
    { text: "answer", sessionId: "session-1" },
  );
  assert.deepEqual(parseResultEnvelope(JSON.stringify({ result: "answer" })), {
    text: "answer",
    sessionId: undefined,
  });
});

test("result envelopes reject agent errors and missing answers", () => {
  assert.throws(
    () =>
      parseResultEnvelope(
        JSON.stringify({ is_error: true, result: "permission denied" }),
      ),
    /permission denied/,
  );
  assert.throws(() => parseResultEnvelope("{}"), /no result/);
});

test("codex events keep the thread id and last agent message", () => {
  const stdout = [
    "not json",
    JSON.stringify({ type: "thread.started", thread_id: "thread-1" }),
    JSON.stringify({ item: { type: "agent_message", text: "draft" } }),
    JSON.stringify({ item: { type: "command", text: "ignored" } }),
    JSON.stringify({ item: { type: "agent_message", text: "final" } }),
  ].join("\n");

  assert.deepEqual(parseCodexEvents(stdout), {
    text: "final",
    sessionId: "thread-1",
  });
  assert.throws(() => parseCodexEvents("{}"), /no agent message/);
});

test("opencode events combine whole text parts and keep revisions", () => {
  const stdout = [
    JSON.stringify({
      type: "text",
      sessionID: "session-1",
      part: { id: "a", text: "old" },
    }),
    "not json",
    JSON.stringify({
      type: "text",
      sessionID: "session-1",
      part: { id: "a", text: "first" },
    }),
    JSON.stringify({
      type: "text",
      sessionID: "session-1",
      part: { id: "b", text: "second" },
    }),
  ].join("\n");

  assert.deepEqual(parseOpencodeEvents(stdout), {
    text: "first\nsecond",
    sessionId: "session-1",
  });
  assert.throws(() => parseOpencodeEvents("{}"), /no answer/);
});
