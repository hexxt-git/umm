import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import {
  DEFAULTS,
  configPath,
  loadConfig,
  saveConfig,
} from "../dist-npm/config.js";
import { appendEntry, historyPath, readHistory } from "../dist-npm/history.js";

let root;
let oldConfigHome;
let oldStateHome;
const execFileAsync = promisify(execFile);

before(() => {
  root = mkdtempSync(join(tmpdir(), "umm-test-"));
  oldConfigHome = process.env.XDG_CONFIG_HOME;
  oldStateHome = process.env.XDG_STATE_HOME;
  process.env.XDG_CONFIG_HOME = join(root, "config");
  process.env.XDG_STATE_HOME = join(root, "state");
});

after(() => {
  if (oldConfigHome === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = oldConfigHome;
  if (oldStateHome === undefined) delete process.env.XDG_STATE_HOME;
  else process.env.XDG_STATE_HOME = oldStateHome;
  rmSync(root, { recursive: true, force: true });
});

test("config round-trips and corrupt JSON falls back to defaults", () => {
  const config = {
    agent: "codex",
    model: "gpt-test",
    length: "brief",
    sources: "off",
  };
  saveConfig(config);
  assert.deepEqual(loadConfig(), config);

  writeFileSync(configPath(), "{broken");
  assert.deepEqual(loadConfig(), DEFAULTS);
});

test("config repairs common JSON and value mistakes", () => {
  mkdirSync(join(root, "config", "umm"), { recursive: true });
  writeFileSync(
    configPath(),
    `\uFEFF{
      // Hand-edited values should be recovered.
      "agent": " CODEX ",
      "model": " gpt-test ",
      "length": "Short",
      "sources": true,
    }`,
  );
  assert.deepEqual(loadConfig(), {
    agent: "codex",
    model: "gpt-test",
    length: "brief",
    sources: "on",
  });

  writeFileSync(
    configPath(),
    JSON.stringify({ agent: "codex", length: 12, sources: "maybe" }),
  );
  assert.deepEqual(loadConfig(), {
    agent: "codex",
    length: "standard",
    sources: "on",
  });
});

test("history skips malformed lines and retains the newest 500 entries", () => {
  const path = historyPath();
  mkdirSync(join(root, "state", "umm"), { recursive: true });
  writeFileSync(path, 'not json\n{"question":"kept"}\n');
  assert.deepEqual(readHistory(), [
    {
      id: "recovered-1",
      ts: "1970-01-01T00:00:00.001Z",
      agent: "claude",
      cwd: process.cwd(),
      length: "standard",
      sources: "on",
      question: "kept",
      answer: "",
    },
  ]);

  rmSync(path);
  for (let i = 0; i < 501; i++) {
    appendEntry({
      id: String(i),
      ts: new Date(i).toISOString(),
      agent: "codex",
      cwd: root,
      length: "brief",
      sources: "off",
      question: `question ${i}`,
      answer: `answer ${i}`,
    });
  }
  const entries = readHistory();
  assert.equal(entries.length, 500);
  assert.equal(entries[0].id, "1");
  assert.equal(entries.at(-1).id, "500");
});

test("history repairs legacy aliases while preserving answer whitespace", () => {
  writeFileSync(
    historyPath(),
    `${JSON.stringify({
      query: "legacy question",
      result: "  indented answer\n",
      agent: " CODEX ",
      length: "long",
      sources: false,
      ts: "not a date",
    })}\n`,
  );

  assert.deepEqual(readHistory(), [
    {
      id: "recovered-0",
      ts: "1970-01-01T00:00:00.000Z",
      agent: "codex",
      cwd: process.cwd(),
      length: "full",
      sources: "off",
      question: "legacy question",
      answer: "  indented answer\n",
    },
  ]);
});

test("concurrent history writers do not overwrite each other", async () => {
  rmSync(historyPath(), { force: true });
  const code = `
    import { appendEntry } from './dist-npm/history.js';
    const id = process.argv[1];
    appendEntry({ id, ts: new Date().toISOString(), agent: 'codex', cwd: process.cwd(), length: 'brief', sources: 'off', question: 'q' + id, answer: 'a' + id });
  `;
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      execFileAsync(
        process.execPath,
        ["--input-type=module", "-e", code, String(i)],
        {
          cwd: process.cwd(),
          env: { ...process.env, XDG_STATE_HOME: process.env.XDG_STATE_HOME },
        },
      ),
    ),
  );

  assert.deepEqual(
    readHistory()
      .map((entry) => Number(entry.id))
      .sort((a, b) => a - b),
    Array.from({ length: 12 }, (_, i) => i),
  );
});
