import assert from "node:assert/strict";
import test from "node:test";
import { render } from "../dist-npm/render/markdown.js";
import {
  displayWidth,
  padTo,
  stripAnsi,
  truncate,
} from "../dist-npm/render/width.js";

test("raw rendering preserves markdown and normalizes the final newline", () => {
  assert.equal(render("**answer**\n\n", { color: false }), "**answer**\n");
});

test("terminal rendering handles common markdown blocks", () => {
  const markdown = [
    "# Heading",
    "",
    "> quoted text",
    "",
    "1. first",
    "2. second",
    "",
    "| A | B |",
    "| - | - |",
    "| one | two |",
    "",
    "```",
    "const answer = 42;",
    "```",
  ].join("\n");
  const output = stripAnsi(render(markdown, { color: true }));

  assert.match(output, /Heading\n───────/);
  assert.match(output, /│ quoted text/);
  assert.match(output, /1\. first\n2\. second/);
  assert.match(output, /┌─────┬─────┐/);
  assert.match(output, /▏ const answer = 42;/);
});

test("display width ignores ANSI and handles combining and wide characters", () => {
  assert.equal(displayWidth("\x1b[31mred\x1b[0m"), 3);
  assert.equal(displayWidth("e\u0301"), 1);
  assert.equal(displayWidth("漢字"), 4);
  assert.equal(displayWidth("🙂"), 2);
});

test("truncate and padTo operate on terminal columns", () => {
  assert.equal(truncate("a漢bc", 4), "a漢…");
  assert.equal(displayWidth(truncate("a漢bc", 4)), 4);
  assert.equal(padTo("漢", 4), "漢  ");
  assert.equal(displayWidth(padTo("漢", 4)), 4);
});
