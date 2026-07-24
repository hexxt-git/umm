#!/usr/bin/env node
// Post-emit fixups for the dist build: guarantee the CLI entry has a node
// shebang and is executable, so `npx umm` / the bin symlink work regardless of
// whether tsc preserved the shebang.
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "dist/index.js");

let src = readFileSync(entry, "utf8");
if (!src.startsWith("#!")) {
  src = "#!/usr/bin/env node\n" + src;
  writeFileSync(entry, src);
}
chmodSync(entry, 0o755);
console.log("postbuild: dist/index.js is executable" + (src.startsWith("#!") ? " with shebang" : ""));
