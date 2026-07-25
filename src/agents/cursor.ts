// `cursor-agent models` prints "<id> - <Display Name>" per line under a header.
import { runModels } from "./discover.js";

export function listCursorModels(): string[] {
  return runModels("cursor-agent", ["models"])
    .map((line) => line.split(" - ")[0].trim())
    .filter((id) => id.length > 0 && !/\s/.test(id));
}
