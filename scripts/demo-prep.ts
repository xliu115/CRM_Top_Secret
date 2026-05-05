/**
 * One-command demo prep for Morgan.
 *
 *   npx tsx scripts/demo-prep.ts
 *
 * Runs lock-morgan-demo-state.ts (idempotent state restore) followed by
 * prewarm-partner.ts (insight enrichment + email pre-gen + briefing
 * response cache warm-up). Safe to run before every dry run and right
 * before the demo itself.
 */
import { spawn } from "node:child_process";

function run(label: string, cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n━━ ${label} ━━`);
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited ${code}`));
    });
  });
}

async function main() {
  await run("Lock state", "npx", [
    "tsx",
    "scripts/lock-morgan-demo-state.ts",
  ]);
  await run("Prewarm", "npx", [
    "tsx",
    "scripts/prewarm-partner.ts",
    "--partner=p-morgan-chen",
    "--no-refresh",
  ]);
  console.log(
    "\n✓ Morgan is locked & warm. Hard-refresh the mobile tab and you're set.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
