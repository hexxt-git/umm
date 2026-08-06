import { renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

// Accept the two mistakes people most often make when hand-editing JSON:
// comments and trailing commas. Strings are preserved byte-for-byte.
function relaxJson(src: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < src.length; i++) {
    const char = src[i];
    const next = src[i + 1];
    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        out += char;
      }
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        i++;
      } else if (char === "\n") {
        out += char;
      }
      continue;
    }
    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
    } else if (char === "/" && next === "/") {
      lineComment = true;
      i++;
    } else if (char === "/" && next === "*") {
      blockComment = true;
      i++;
    } else {
      out += char;
    }
  }

  let cleaned = "";
  inString = false;
  escaped = false;
  for (let i = 0; i < out.length; i++) {
    const char = out[i];
    if (inString) {
      cleaned += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      cleaned += char;
      continue;
    }
    if (char === ",") {
      let next = i + 1;
      while (/\s/.test(out[next] ?? "")) next++;
      if (out[next] === "}" || out[next] === "]") continue;
    }
    cleaned += char;
  }
  return cleaned;
}

export function parsePersistedJson(src: string): unknown {
  const clean = src.replace(/^\uFEFF/, "");
  try {
    return JSON.parse(clean);
  } catch {
    try {
      return JSON.parse(relaxJson(clean));
    } catch {
      return undefined;
    }
  }
}

export function writeFileAtomic(path: string, body: string): void {
  const tmp = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}.tmp`,
  );
  try {
    writeFileSync(tmp, body, { mode: 0o600 });
    renameSync(tmp, path);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {}
  }
}
