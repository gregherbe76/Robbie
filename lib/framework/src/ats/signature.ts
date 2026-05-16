/**
 * Canonical signature helpers for the ATS layer.
 *
 * Kept separate from `operations_maturity/signature.ts` only so this
 * module can be consumed by browsers (no node crypto import inside
 * the framework barrel). We re-export the same helper from
 * `operations_maturity` for symmetry.
 */

export { canonicalStringify, shortSignature } from "../operations_maturity/signature.js";
