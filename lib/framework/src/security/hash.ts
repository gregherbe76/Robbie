/**
 * Deterministic FNV-1a hash for stable ids across the security layer. Mirrors
 * the collaboration and ingestion hashes — not a cryptographic primitive,
 * purely a content-addressable id generator so identical inputs always produce
 * identical ids (essential for replayability and deterministic audit).
 */

export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function makeId(prefix: string, ...parts: Array<string | number>): string {
  return `${prefix}_${fnv1a(parts.map(String).join("|"))}`;
}

/**
 * Deterministic, non-cryptographic action signature. Combines reviewer +
 * session + payload hash so two reviewers cannot produce the same signature
 * for the same payload and signatures are replayable in tests.
 */
export function signActionHash(
  sessionId: string,
  reviewerId: string,
  payloadHash: string,
  timestamp: string,
): string {
  return fnv1a([sessionId, reviewerId, payloadHash, timestamp].join("|"));
}
