/**
 * Replay signature golden test.
 *
 * The framework's strongest public claim is deterministic replay
 * integrity: same evidence → same replay → same signature, across
 * runtimes, indefinitely. This script enforces that claim in CI.
 *
 * It builds the Marcus Vega (regretted override) and Lena Park
 * (calibrated decline) replays from the synthetic adapter and asserts
 * that their signatures and version stamps match the pinned values
 * below. If you intentionally bump CANONICAL_BODY_VERSION,
 * REPLAY_BUILDER_VERSION, or NORMALIZATION_VERSION, you MUST also
 * update the goldens here in the same commit and document why in the
 * commit message. Any other signature change indicates hidden
 * nondeterminism, serialization drift, or an accidental semantic
 * change in normalization / builder logic — and should block release.
 *
 * Run via: `pnpm test:replay-goldens` (from repo root) or
 *          `pnpm --filter @workspace/scripts run test:replay-goldens`.
 */

import {
  SyntheticATSAdapter,
  SYNTHETIC_CONNECTION,
  buildHiringDecisionReplay,
  CANONICAL_BODY_VERSION,
  REPLAY_BUILDER_VERSION,
  NORMALIZATION_VERSION,
} from "@workspace/framework/ats";

interface Golden {
  candidateAtsId: string;
  expectedSignature: string;
  expectedCanonicalBodyVersion: number;
  expectedReplayBuilderVersion: number;
  expectedNormalizationVersion: number;
}

const GOLDENS: Golden[] = [
  {
    candidateAtsId: "cand_marcus_vega",
    expectedSignature: "294857d856898b00",
    expectedCanonicalBodyVersion: 1,
    expectedReplayBuilderVersion: 1,
    expectedNormalizationVersion: 1,
  },
  {
    candidateAtsId: "cand_lena_park",
    expectedSignature: "f8537c0e10dd5e4a",
    expectedCanonicalBodyVersion: 1,
    expectedReplayBuilderVersion: 1,
    expectedNormalizationVersion: 1,
  },
];

const CONNECTION_ID = SYNTHETIC_CONNECTION.id;

/**
 * Mirror the ingestion gateway's deterministic derivation of
 * `ingestedAt` from the source records' own `fetchedAt` timestamps.
 * The goldens are signed with this value, so the script MUST compute
 * it the same way the production runtime does — otherwise the test
 * would not actually be testing what production signs.
 */
function deriveIngestedAt(
  records: ReadonlyArray<{ fetchedAt: string }>,
): string {
  if (records.length === 0) return new Date(0).toISOString();
  return records.reduce<string>(
    (max, r) => (r.fetchedAt > max ? r.fetchedAt : max),
    records[0]!.fetchedAt,
  );
}

/**
 * Seeded linear-congruential shuffle. Deterministic given a seed.
 * Used to assert the canonical body is invariant under raw-record
 * reordering — i.e. that every sort in the normalization / builder
 * pipeline is stable on content alone.
 */
function deterministicShuffle<T>(input: ReadonlyArray<T>, seed: number): T[] {
  const out = [...input];
  let s = seed >>> 0;
  const next = (): number => {
    // Numerical Recipes LCG
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

interface Failure {
  candidateAtsId: string;
  field: string;
  expected: string | number;
  actual: string | number;
}

async function main(): Promise<void> {
  const adapter = new SyntheticATSAdapter();
  const failures: Failure[] = [];

  for (const golden of GOLDENS) {
    const records = await adapter.fetchHiringProcess(golden.candidateAtsId);
    if (records.length === 0) {
      failures.push({
        candidateAtsId: golden.candidateAtsId,
        field: "records",
        expected: ">0 raw records",
        actual: "0",
      });
      continue;
    }

    const ingestedAt = deriveIngestedAt(records);
    const replay = buildHiringDecisionReplay(records, {
      connectionId: CONNECTION_ID,
      candidateAtsId: golden.candidateAtsId,
      ingestedAt,
    });

    // Permutation invariance: shuffle the raw record stream with a
    // deterministic LCG and rebuild. Signature MUST be identical —
    // the canonical body must depend only on record content, not on
    // upstream emission order. This catches the class of silent
    // regression where someone removes a stable sort in the
    // normalization pipeline or in one of the derivers.
    const PERMUTATIONS = 8;
    for (let p = 1; p <= PERMUTATIONS; p++) {
      const shuffled = deterministicShuffle(records, 0xc0ffee + p);
      const permReplay = buildHiringDecisionReplay(shuffled, {
        connectionId: CONNECTION_ID,
        candidateAtsId: golden.candidateAtsId,
        ingestedAt,
      });
      if (permReplay.signature !== replay.signature) {
        failures.push({
          candidateAtsId: golden.candidateAtsId,
          field: `permutation-${p}.signature`,
          expected: replay.signature,
          actual: permReplay.signature,
        });
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `  ok  ${golden.candidateAtsId}.permutation-invariance × ${PERMUTATIONS}`,
    );

    const checks: Array<[string, string | number, string | number]> = [
      ["signature", golden.expectedSignature, replay.signature],
      [
        "canonicalBodyVersion",
        golden.expectedCanonicalBodyVersion,
        replay.canonicalBodyVersion,
      ],
      [
        "replayBuilderVersion",
        golden.expectedReplayBuilderVersion,
        replay.replayBuilderVersion,
      ],
      [
        "normalizationVersion",
        golden.expectedNormalizationVersion,
        replay.normalizationVersion,
      ],
    ];

    for (const [field, expected, actual] of checks) {
      if (expected !== actual) {
        failures.push({
          candidateAtsId: golden.candidateAtsId,
          field,
          expected,
          actual,
        });
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `  ok  ${golden.candidateAtsId}.${field} = ${String(actual)}`,
        );
      }
    }
  }

  // Sanity-check the version constants the script imports against the
  // values the golden table expects. This catches the case where a
  // contributor bumps a constant but forgets to update the table.
  if (CANONICAL_BODY_VERSION !== GOLDENS[0]!.expectedCanonicalBodyVersion) {
    failures.push({
      candidateAtsId: "(constants)",
      field: "CANONICAL_BODY_VERSION",
      expected: GOLDENS[0]!.expectedCanonicalBodyVersion,
      actual: CANONICAL_BODY_VERSION,
    });
  }
  if (REPLAY_BUILDER_VERSION !== GOLDENS[0]!.expectedReplayBuilderVersion) {
    failures.push({
      candidateAtsId: "(constants)",
      field: "REPLAY_BUILDER_VERSION",
      expected: GOLDENS[0]!.expectedReplayBuilderVersion,
      actual: REPLAY_BUILDER_VERSION,
    });
  }
  if (NORMALIZATION_VERSION !== GOLDENS[0]!.expectedNormalizationVersion) {
    failures.push({
      candidateAtsId: "(constants)",
      field: "NORMALIZATION_VERSION",
      expected: GOLDENS[0]!.expectedNormalizationVersion,
      actual: NORMALIZATION_VERSION,
    });
  }

  if (failures.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      `\nreplay-goldens: ${GOLDENS.length} replay(s) verified · determinism invariant holds.`,
    );
    process.exit(0);
  }

  // eslint-disable-next-line no-console
  console.error("\nreplay-goldens: FAILURES");
  for (const f of failures) {
    // eslint-disable-next-line no-console
    console.error(
      `  fail  ${f.candidateAtsId}.${f.field}: expected ${String(f.expected)}, got ${String(f.actual)}`,
    );
  }
  // eslint-disable-next-line no-console
  console.error(
    "\nIf this is an intentional semantic change, bump the relevant *Version constant " +
      "and update the goldens in the same commit.",
  );
  process.exit(1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("replay-goldens: crashed");
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
