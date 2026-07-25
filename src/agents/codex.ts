// Codex exposes models via a `model/list` JSON-RPC method on its app-server
// (newline-delimited stdio). Resolves [] on any failure.
import { spawn } from "node:child_process";

export function listCodexModels(): Promise<string[]> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (models: string[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {}
      resolve(models);
    };

    const timer = setTimeout(() => finish([]), 8000);
    const child = spawn("codex", ["app-server"], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    child.on("error", () => finish([]));

    const send = (msg: unknown) => {
      try {
        child.stdin.write(JSON.stringify(msg) + "\n");
      } catch {
        finish([]);
      }
    };

    let buf = "";
    child.stdout.on("data", (chunk) => {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: { id?: number; result?: { data?: unknown } };
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id === 1) {
          send({ jsonrpc: "2.0", id: 2, method: "model/list", params: {} });
        } else if (msg.id === 2) {
          const data = Array.isArray(msg.result?.data) ? msg.result.data : [];
          finish(
            data
              .map((m) => (m as { id?: unknown }).id)
              .filter((id): id is string => typeof id === "string"),
          );
        }
      }
    });

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { clientInfo: { name: "umm", version: "0" } },
    });
  });
}
