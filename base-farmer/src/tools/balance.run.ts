import { it } from "vitest";
import { balanceReport } from "./balanceReport";

// Not part of `npm test`: run with `npm run balance` (BALANCE_SEEDS=<n> for more seeds).
it("balance report", () => {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  console.log(balanceReport(Number(env?.BALANCE_SEEDS ?? 6)));
}, 600_000);
