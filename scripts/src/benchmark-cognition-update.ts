import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runBenchmarkSuite,
  serializeSnapshot,
  renderConsoleSummary,
} from "@robbie/framework/benchmarks";

const SNAPSHOT_PATH = fileURLToPath(
  new URL("../../tests/cognitive-smoke/snapshot.json", import.meta.url),
);

const { report, snapshot } = runBenchmarkSuite({});
mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
writeFileSync(SNAPSHOT_PATH, serializeSnapshot(snapshot) + "\n", "utf8");
process.stdout.write(renderConsoleSummary(report) + "\n");
process.stdout.write(`\nSnapshot written to ${SNAPSHOT_PATH}\n`);
process.stdout.write(
  `${snapshot.entries.length} scenarios captured at ${snapshot.generatedAt}\n`,
);
