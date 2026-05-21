import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  runBenchmarkSuite,
  renderConsoleSummary,
  renderMarkdownReport,
  parseSnapshot,
} from "@robbie/framework/benchmarks";

const SNAPSHOT_PATH = fileURLToPath(
  new URL("../../tests/cognitive-smoke/snapshot.json", import.meta.url),
);

function loadSnapshot() {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    return parseSnapshot(readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch (e) {
    process.stderr.write(
      `! failed to parse snapshot at ${SNAPSHOT_PATH}: ${(e as Error).message}\n`,
    );
    return null;
  }
}

const args = new Set(process.argv.slice(2));
const printMarkdown = args.has("--markdown");

const baseline = loadSnapshot();
const { report } = runBenchmarkSuite({ baselineSnapshot: baseline });

if (printMarkdown) {
  process.stdout.write(renderMarkdownReport(report));
} else {
  process.stdout.write(renderConsoleSummary(report) + "\n");
}

const failed =
  report.summary.failed > 0 ||
  !report.summary.determinismOk ||
  !report.summary.provenanceOk ||
  !report.summary.calibrationOk ||
  !report.summary.mutationGuardsOk;

process.exit(failed ? 1 : 0);
