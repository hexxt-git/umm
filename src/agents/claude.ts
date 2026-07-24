// Claude has no "list models" command, so mine model ids out of its binary and
// keep the newest per family. Returns [] on any failure (callers fall back).
import { execFileSync } from "node:child_process";

export function listClaudeModels(): string[] {
  if (process.platform === "win32") return []; // `strings` is POSIX-only
  const bin = resolveBin("claude");
  if (!bin) return [];

  const out = execFileSync("strings", ["-n", "8", bin], {
    encoding: "utf8",
    timeout: 8000,
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });

  // Naming the alias families keeps out internal noise (mythos/instant/desktop).
  const ids =
    out.match(/claude-(?:opus|sonnet|haiku|fable)-\d+(?:-\d+)?/g) ?? [];

  const best = new Map<string, { id: string; ver: number[] }>();
  for (const id of new Set(ids)) {
    const m = id.match(/^(claude-[a-z]+)-([\d-]+)$/);
    if (!m) continue;
    const ver = m[2].split("-").map(Number);
    if (ver.some((n) => n >= 1e7)) continue; // an 8-digit segment is a date
    const cur = best.get(m[1]);
    if (!cur || cmpVer(ver, cur.ver) > 0) best.set(m[1], { id, ver });
  }
  return [...best.values()].map((v) => v.id).sort();
}

function cmpVer(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

function resolveBin(bin: string): string | null {
  try {
    return (
      execFileSync("which", [bin], { encoding: "utf8" })
        .split("\n")[0]
        .trim() || null
    );
  } catch {
    return null;
  }
}
