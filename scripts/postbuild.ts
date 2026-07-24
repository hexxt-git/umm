#!/usr/bin/env node
// Post-emit fixups for the dist build: guarantee the CLI entry has a node
// shebang and is executable (so `npx umm` / the bin symlink work regardless of
// whether tsc preserved the shebang), and copy README.md alongside the output.
import { readFileSync, writeFileSync, chmodSync, copyFileSync } from "node:fs";
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

copyFileSync(join(root, "README.md"), join(root, "dist/README.md"));

console.log(
  "postbuild: dist/index.js executable with shebang; README.md copied",
);
