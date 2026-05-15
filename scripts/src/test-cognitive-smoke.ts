/**
 * Cognitive smoke test — the fastest assertion that the cognition pipeline
 * still behaves the way it did when the baseline snapshot was captured.
 *
 * Failure modes (any one of these will fail the suite):
 *   - any scenario's behavioral expectations regress
 *   - any scenario's structural digest hash drifts from the snapshot
 *   - determinism check (twice run → same hash) fails
 *   - provenance integrity fails
 *   - calibration smoke ECE blows past the threshold
 *   - mutation guards stop catching the regressions they were designed for
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  runBenchmarkSuite,
  parseSnapshot,
  renderConsoleSummary,
} from "@workspace/framework/benchmarks";

const SNAPSHOT_PATH = fileURLToPath(
  new URL("../../tests/cognitive-smoke/snapshot.json", import.meta.url),
);

if (!existsSync(SNAPSHOT_PATH)) {
  process.stderr.write(
    `! no baseline snapshot at ${SNAPSHOT_PATH}\n` +
      `  Run \`pnpm benchmark:cognition:update\` first to seed it.\n`,
  );
  process.exit(2);
}

const baseline = parseSnapshot(readFileSync(SNAPSHOT_PATH, "utf8"));
const { report } = runBenchmarkSuite({ baselineSnapshot: baseline });

process.stdout.write(renderConsoleSummary(report) + "\n");

const failed =
  report.summary.failed > 0 ||
  !report.summary.determinismOk ||
  !report.summary.provenanceOk ||
  !report.summary.calibrationOk ||
  !report.summary.snapshotOk ||
  !report.summary.mutationGuardsOk;

if (failed) {
  process.stderr.write(
    "\nCognitive smoke test FAILED. If this is an intentional behaviour change,\n" +
      "re-baseline with `pnpm benchmark:cognition:update`.\n",
  );
}

process.exit(failed ? 1 : 0);
