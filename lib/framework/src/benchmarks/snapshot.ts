/**
 * RegressionSnapshotEngine — pure data utilities for structural snapshots.
 *
 * Snapshots are intentionally minimal: scenario digest + determinism hash.
 * No natural-language text, no LLM output, no timestamps that would drift.
 * The CLI handles disk I/O; this module handles compare / update.
 */

import { BENCHMARK_CLOCK_ISO } from "./runner.js";
import type {
  ScenarioOutputs,
  SnapshotDriftResult,
  SnapshotEntry,
  SnapshotFile,
} from "./types.js";

export function buildSnapshot(outputs: ScenarioOutputs[]): SnapshotFile {
  const entries: SnapshotEntry[] = outputs.map((o) => ({
    scenarioId: o.scenarioId,
    determinismHash: o.determinismHash,
    digest: o.digest,
  }));
  // Stable order — sort by scenarioId so snapshot file diffs are minimal.
  entries.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
  return { version: 1, generatedAt: BENCHMARK_CLOCK_ISO, entries };
}

export function compareSnapshots(
  baseline: SnapshotFile | null,
  current: SnapshotFile,
): SnapshotDriftResult {
  if (!baseline) {
    return {
      ok: false,
      drift: [
        {
          scenarioId: current.entries[0]?.scenarioId ?? ("inflated_senior" as const),
          kind: "missing",
          detail: "no baseline snapshot on disk — run benchmark:cognition:update to seed",
        },
      ],
    };
  }
  const drift: SnapshotDriftResult["drift"] = [];
  const baseMap = new Map(baseline.entries.map((e) => [e.scenarioId, e]));
  const curMap = new Map(current.entries.map((e) => [e.scenarioId, e]));
  for (const [id, baseEntry] of baseMap) {
    const cur = curMap.get(id);
    if (!cur) {
      drift.push({ scenarioId: id, kind: "missing", detail: "scenario absent from current run" });
      continue;
    }
    if (cur.determinismHash !== baseEntry.determinismHash) {
      const changed: string[] = [];
      (Object.keys(baseEntry.digest) as Array<keyof typeof baseEntry.digest>).forEach((k) => {
        if (JSON.stringify(baseEntry.digest[k]) !== JSON.stringify(cur.digest[k])) {
          changed.push(
            `${String(k)}: ${JSON.stringify(baseEntry.digest[k])} -> ${JSON.stringify(cur.digest[k])}`,
          );
        }
      });
      drift.push({
        scenarioId: id,
        kind: "hash-changed",
        detail: `hash ${baseEntry.determinismHash} -> ${cur.determinismHash}; fields: ${changed.join("; ") || "none (hash only)"}`,
      });
    }
  }
  for (const [id] of curMap) {
    if (!baseMap.has(id))
      drift.push({ scenarioId: id, kind: "extra", detail: "scenario not present in baseline" });
  }
  return { ok: drift.length === 0, drift };
}

export function serializeSnapshot(snapshot: SnapshotFile): string {
  return JSON.stringify(snapshot, null, 2) + "\n";
}

export function parseSnapshot(raw: string): SnapshotFile | null {
  try {
    const parsed = JSON.parse(raw) as SnapshotFile;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
}
