/**
 * Deterministic source-chronology extraction.
 *
 * Replay signatures are derived from operational evidence chronology,
 * not runtime wallclock behavior. Adapters MUST NOT stamp `fetchedAt`
 * from `new Date()` — that value flows into the signed canonical
 * body and would shift on every fetch/restart, silently violating
 * the determinism contract.
 *
 * `extractSourceChronologyTimestamp` walks an arbitrary set of source
 * payloads, collects timestamps from a known allow-list of ATS keys,
 * and returns the maximum (most recent source event). The maximum is
 * the right anchor for batch semantics: "the chronological frontier
 * of evidence as observed in this fetch."
 *
 * The function is:
 *   - **deterministic**: pure function of payload content.
 *   - **permutation-invariant**: insertion order of payloads has no
 *     effect on the result.
 *   - **shape-agnostic**: walks plain objects + arrays, ignores other
 *     types. Designed for vendor-specific JSON.
 *
 * Use `CHRONOLOGY_KEYS` if a caller wants to assert which keys are
 * considered authoritative source events.
 */

/**
 * Allow-list of object keys treated as authoritative source-event
 * timestamps. We deliberately allow both `snake_case` (Greenhouse)
 * and `camelCase` (Ashby). New ATS providers should add their keys
 * here rather than introduce side-channel timestamp sources.
 */
export const CHRONOLOGY_KEYS: ReadonlySet<string> = new Set([
  // Lifecycle
  "created_at",
  "createdAt",
  "updated_at",
  "updatedAt",
  "closed_at",
  "closedAt",
  "last_activity_at",
  "lastActivityAt",
  // Interview / feedback
  "submitted_at",
  "submittedAt",
  "sent_at",
  "sentAt",
  "completed_at",
  "completedAt",
  "started_at",
  "startedAt",
  // Decision
  "decided_at",
  "decidedAt",
  "rejected_at",
  "rejectedAt",
  "hired_at",
  "hiredAt",
]);

/**
 * ISO-8601 shape check — accepts `Z`, `±hh:mm`, and `±hhmm` offsets
 * and optional sub-second precision. We must accept all of these
 * because Ashby returns `Z`, Greenhouse historically returned
 * `±hh:mm`, and some third-party exports use `±hhmm`.
 */
const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && ISO_RE.test(value);
}

/**
 * Parse an ISO timestamp to epoch milliseconds. Returns NaN if the
 * runtime rejects the string — caller filters those out. We rely
 * on `Date.parse` rather than implementing a parser; all major
 * JS runtimes accept the formats permitted by `ISO_RE`.
 */
function isoToEpochMs(iso: string): number {
  return Date.parse(iso);
}

function collect(
  payload: unknown,
  keys: ReadonlySet<string>,
  into: string[],
): void {
  if (payload === null || payload === undefined) return;
  if (Array.isArray(payload)) {
    for (const item of payload) collect(item, keys, into);
    return;
  }
  if (typeof payload !== "object") return;
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (keys.has(key) && isIsoTimestamp(value)) {
      into.push(value);
    }
    // Recurse regardless — nested objects (e.g. application → current_stage
    // → updated_at) carry chronology too.
    if (value && typeof value === "object") collect(value, keys, into);
  }
}

export interface ExtractChronologyOptions {
  /**
   * Provider-specific chronology keys to honor *in addition to*
   * `CHRONOLOGY_KEYS`. Adapters should pass their own keys here
   * rather than mutating the shared set.
   */
  readonly additionalKeys?: ReadonlyArray<string>;
}

/**
 * Pick the deterministic source-chronology anchor from a batch of
 * ATS payloads.
 *
 * Returns the chronologically maximum timestamp (most recent source
 * event) found under any known chronology key, anywhere in the
 * payload tree, emitted as a canonical UTC ISO-8601 string with
 * millisecond precision (`YYYY-MM-DDTHH:mm:ss.sssZ`).
 *
 * Why parse-then-max instead of lexical max: timestamps from real
 * ATSes mix offsets (`Z`, `+hh:mm`, `+hhmm`) and fractional-second
 * precision. Lexical order disagrees with chronological order across
 * those formats — `"2026-04-05T10:00:00+02:00"` (= 08:00 UTC) sorts
 * AFTER `"2026-04-05T09:00:00Z"` lexically but BEFORE it
 * chronologically. We parse to epoch ms, take the numeric max, and
 * re-emit in canonical UTC so the signed `fetchedAt` is both
 * chronologically correct and serialization-stable across
 * providers.
 *
 * Throws if no chronology timestamp is found anywhere. Adapters
 * MUST fail loud rather than fall back to wallclock — silently
 * substituting `new Date()` is exactly the bug this module exists
 * to prevent.
 */
export function extractSourceChronologyTimestamp(
  payloads: ReadonlyArray<unknown>,
  options: ExtractChronologyOptions = {},
): string {
  const keys = options.additionalKeys?.length
    ? new Set<string>([...CHRONOLOGY_KEYS, ...options.additionalKeys])
    : CHRONOLOGY_KEYS;
  const stamps: string[] = [];
  for (const p of payloads) collect(p, keys, stamps);
  if (stamps.length === 0) {
    throw new Error(
      "extractSourceChronologyTimestamp: no chronology timestamps found in payload batch. " +
        "Adapter must surface at least one of: " +
        [...keys].join(", "),
    );
  }
  let maxMs = -Infinity;
  for (const s of stamps) {
    const ms = isoToEpochMs(s);
    if (!Number.isNaN(ms) && ms > maxMs) maxMs = ms;
  }
  if (!Number.isFinite(maxMs)) {
    throw new Error(
      "extractSourceChronologyTimestamp: chronology keys present but none parsed as ISO-8601: " +
        stamps.join(", "),
    );
  }
  return new Date(maxMs).toISOString();
}
