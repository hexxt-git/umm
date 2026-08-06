import assertModule from "assert";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCodexEvents } from "../dist-npm/agents/session.js";
import { render } from "../dist-npm/render/markdown.js";
import { displayWidth } from "../dist-npm/render/width.js";

const assert = assertModule.strict;

const project = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const root = mkdtempSync(join(tmpdir(), "umm-node-runtime-"));
const binDir = join(root, "bin");
const configDir = join(root, "config", "umm");
const stateDir = join(root, "state");

try {
  mkdirSync(binDir, { recursive: true });
  mkdirSync(configDir, { recursive: true });
  const fakeClaude = join(binDir, "claude");
  writeFileSync(
    fakeClaude,
    `#!/usr/bin/env node
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  if (!input.includes("umm hello world")) process.exit(2);
  process.stdout.write(JSON.stringify({ result: "**ok**\\n\\nNode 14", session_id: "smoke-session" }));
});
`,
  );
  chmodSync(fakeClaude, 0o755);
  writeFileSync(
    join(configDir, "config.json"),
    JSON.stringify({ agent: "claude", length: "brief", sources: "off" }),
  );

  const cli = spawnSync(
    process.execPath,
    [join(project, "dist-npm", "index.js"), "--raw", "hello", "world"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}${delimiter}${process.env.PATH || ""}`,
        XDG_CONFIG_HOME: join(root, "config"),
        XDG_STATE_HOME: stateDir,
      },
    },
  );
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(cli.stdout, "**ok**\n\nNode 14\n");

  const history = readFileSync(join(stateDir, "umm", "history.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.equal(history.length, 1);
  assert.equal(history[0].question, "hello world");
  assert.equal(history[0].sessionId, "smoke-session");

  assert.match(render("- runtime smoke", { color: true }), /runtime smoke/);
  assert.equal(displayWidth("漢字"), 4);
  assert.equal(
    parseCodexEvents(
      JSON.stringify({ item: { type: "agent_message", text: "ok" } }),
    ).text,
    "ok",
  );
  process.stdout.write(`Node ${process.versions.node} runtime smoke passed\n`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
