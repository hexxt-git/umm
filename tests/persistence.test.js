import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("history skips malformed lines and retains the newest 500 entries", () => {
  const path = historyPath();
  mkdirSync(join(root, "state", "umm"), { recursive: true });
  writeFileSync(path, 'not json\n{"question":"kept"}\n');
  assert.deepEqual(readHistory(), [{ question: "kept" }]);

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
