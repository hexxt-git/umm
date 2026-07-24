#!/usr/bin/env node
// Dev helper: render a saved markdown file through the terminal renderer with
// color forced on, regardless of TTY. Usage: node scripts/render-file.ts <file>
import { readFileSync } from "node:fs";
import { render } from "../src/render/markdown.js";

const file = process.argv[2];
if (!file) {
  process.stderr.write("usage: render-file <path>\n");
  process.exit(1);
}
process.stdout.write(render(readFileSync(file, "utf8"), { color: true }));
