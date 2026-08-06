import assert from "node:assert/strict";
import test from "node:test";
import { buildPrompt, runAgent } from "../dist-npm/run.js";

test("buildPrompt appends configuration and the literal query", () => {
  const prompt = buildPrompt("what does --force do", {
    agent: "codex",
    length: "brief",
    sources: "off",
  });

  assert.match(prompt, /## Configuration\n- length: brief\n- sources: off/);
  assert.ok(prompt.endsWith("\n\n---\n\numm what does --force do"));
});

test("runAgent sends stdin and parses a resumable envelope", async () => {
  const code = [
    "let input = '';",
    "process.stdin.on('data', chunk => input += chunk);",
    "process.stdin.on('end', () => process.stdout.write(JSON.stringify({ result: input, session_id: 's1' })));",
  ].join("");
  const agent = {
    name: "fixture",
    bin: process.execPath,
    args: ["-e", code],
    input: "stdin",
    resume: {
      printArgs: [],
      parse: (stdout) => {
        const value = JSON.parse(stdout);
        return { text: value.result, sessionId: value.session_id };
      },
      args: () => [],
    },
  };

  assert.deepEqual(await runAgent(agent, "hello"), {
    text: "hello",
    sessionId: "s1",
  });
});

test("runAgent surfaces non-zero exits", async () => {
  const agent = {
    name: "fixture",
    bin: process.execPath,
    args: ["-e", "process.stderr.write('bad input'); process.exit(2)"],
    input: "stdin",
  };

  await assert.rejects(runAgent(agent, "hello"), /fixture failed: bad input/);
});
