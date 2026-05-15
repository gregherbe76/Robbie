/**
 * Deterministic FNV-1a hash for stable ids across the collaboration layer.
 *
 * Mirrors lib/framework/src/ingestion/hash.ts. Not a security primitive — just
 * a content-addressable id generator so the same inputs produce the same ids.
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
