/**
 * Extension manifests for the OSS ecosystem.
 *
 * External packages extend the framework by registering one or more of
 * the manifest kinds below. The framework validates compatibility at
 * load time using `frameworkVersion` and the per-kind compatibility
 * predicates. Nothing here introduces new cognition — these contracts
 * describe how existing modules accept third-party extensions.
 */

/** Semver-like version supported by this framework release. */
export const FRAMEWORK_API_VERSION = "0.1.0";

export type ManifestKind =
  | "plugin"
  | "benchmark-pack"
  | "ingestion-adapter"
  | "cognition-module"
  | "organization-policy";

export interface ManifestBase {
  /** Globally unique id. Convention: `@scope/name`. */
  id: string;
  kind: ManifestKind;
  name: string;
  /** Plain-text summary. Shown in the Console + docs. */
  description: string;
  /** Semver version of the manifest itself. */
  version: string;
  /** Required framework API version (range, semver). */
  frameworkVersion: string;
  author?: string;
  homepage?: string;
  license?: string;
}

/**
 * Generic plugin manifest: registers one or more of the more specific
 * manifest kinds. Used by `@workspace/framework` to load extensions at
 * runtime without dynamic imports leaking provenance.
 */
export interface PluginManifest extends ManifestBase {
  kind: "plugin";
  /** Manifests registered by this plugin. */
  provides: Array<
    | BenchmarkPackManifest
    | IngestionAdapterManifest
    | CognitionModuleManifest
    | OrganizationPolicyManifest
  >;
}

/**
 * A benchmark pack adds scenarios and mutation guards to the benchmark
 * layer. Scenarios must be deterministic; mutation guards must fail
 * loudly when violated.
 */
export interface BenchmarkPackManifest extends ManifestBase {
  kind: "benchmark-pack";
  /** Scenario ids contributed by this pack. */
  scenarioIds: string[];
  /** Mutation-guard names contributed by this pack. */
  mutationGuardNames: string[];
  /** Determinism contract: same input → same trace bytes. */
  deterministic: true;
}

/**
 * An ingestion adapter normalises one source kind into the framework's
 * evidence/claim model. Every adapter must preserve provenance and
 * report its own reliability factors.
 */
export interface IngestionAdapterManifest extends ManifestBase {
  kind: "ingestion-adapter";
  /** Source identifier (e.g. `github`, `linkedin`, `transcript`). */
  sourceKind: string;
  /** Required input fields the adapter consumes. */
  requiredInputs: string[];
  /** Provenance fields the adapter is guaranteed to populate. */
  providesProvenance: string[];
  /** True if the adapter declares reliability factors per evidence item. */
  declaresReliability: boolean;
}

/**
 * A cognition module contributes reasoning into the cognition layer
 * (e.g. a new disagreement detector, an additional uncertainty
 * fusion strategy). Modules must be deterministic and must not
 * silently mutate inputs.
 */
export interface CognitionModuleManifest extends ManifestBase {
  kind: "cognition-module";
  /** Cognition surface this module hooks into. */
  hook:
    | "confidence-propagation"
    | "disagreement-detection"
    | "uncertainty-fusion"
    | "recommendation-reconciliation";
  /** Whether the module emits its own provenance nodes. */
  emitsProvenance: boolean;
  /** Whether the module can change a recommendation category. */
  canChangeRecommendation: boolean;
}

/**
 * An organization policy contributes role-environment fit rules and
 * mismatch detectors specific to a class of organization (e.g. early
 * stage chaos, post-IPO structured, regulated).
 */
export interface OrganizationPolicyManifest extends ManifestBase {
  kind: "organization-policy";
  /** Organization-style identifier this policy applies to. */
  orgStyle: string;
  /** Mismatch detector names contributed by this policy. */
  detectors: string[];
  /** Whether escalations from this policy may block advancement. */
  canBlockAdvancement: boolean;
}

export type Manifest =
  | PluginManifest
  | BenchmarkPackManifest
  | IngestionAdapterManifest
  | CognitionModuleManifest
  | OrganizationPolicyManifest;

/**
 * Conservative semver-range checker for the framework API version.
 * Accepts patterns of the form:
 *   "^0.1.0" — same major (0) and minor (1), any patch
 *   "~0.1.0" — same major and minor, patch >= 0
 *   "0.1.x" — explicit minor, any patch
 *   "0.1.0" — exact match
 */
export function isCompatibleFrameworkVersion(
  manifestRange: string,
  frameworkVersion: string = FRAMEWORK_API_VERSION,
): boolean {
  const v = frameworkVersion.split(".").map((x) => Number(x));
  if (v.length !== 3 || v.some((n) => Number.isNaN(n))) return false;
  const [fMaj, fMin] = v;

  const trimmed = manifestRange.trim();
  if (trimmed === frameworkVersion) return true;

  if (trimmed.startsWith("^") || trimmed.startsWith("~")) {
    const rest = trimmed.slice(1).split(".").map((x) => Number(x));
    if (rest.length !== 3 || rest.some((n) => Number.isNaN(n))) return false;
    return rest[0] === fMaj && rest[1] === fMin;
  }

  const parts = trimmed.split(".");
  if (parts.length === 3 && parts[2] === "x") {
    return Number(parts[0]) === fMaj && Number(parts[1]) === fMin;
  }

  return false;
}

/**
 * Validate a manifest's intrinsic shape and framework-version
 * compatibility. Returns a list of human-readable issues; an empty
 * list means the manifest is loadable.
 */
export function validateManifest(m: Manifest): string[] {
  const issues: string[] = [];
  if (!m.id) issues.push("manifest.id is required");
  if (!m.name) issues.push("manifest.name is required");
  if (!m.version) issues.push("manifest.version is required");
  if (!isCompatibleFrameworkVersion(m.frameworkVersion)) {
    issues.push(
      `manifest.frameworkVersion ${m.frameworkVersion} is not compatible with framework ${FRAMEWORK_API_VERSION}`,
    );
  }
  if (m.kind === "benchmark-pack" && !m.deterministic) {
    issues.push("benchmark-pack must be deterministic");
  }
  if (m.kind === "ingestion-adapter" && !m.declaresReliability) {
    issues.push("ingestion-adapter must declare reliability factors");
  }
  if (m.kind === "cognition-module" && !m.emitsProvenance) {
    issues.push(
      "cognition-module must emit provenance — silent reasoning is not loadable",
    );
  }
  return issues;
}
