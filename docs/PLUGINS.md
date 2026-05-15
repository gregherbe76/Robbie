# Extension contracts

The framework is shipped as a library. External packages extend it by
registering one or more typed **manifests**. Every manifest declares its
target framework API version and, depending on its kind, its determinism
and provenance contract.

The TypeScript definitions live in
[`lib/framework/src/registry/manifests.ts`](../lib/framework/src/registry/manifests.ts)
and are re-exported from `@workspace/framework/registry`.

> **Note.** This document describes the contract. The dynamic loader is
> intentionally a thin layer (validate → register) and is not yet wired
> into the runtime bootstrap. Today, plugins are imported statically in
> `artifacts/api-server/src/framework/bootstrap.ts`. The static path is
> the supported one for the OSS skeleton; the dynamic loader is a stub
> for ecosystem packages.

## Manifest kinds

| Kind                  | Adds to                                  | Determinism | Provenance |
| --------------------- | ---------------------------------------- | ----------- | ---------- |
| `plugin`              | Container that registers other manifests | inherited   | inherited  |
| `benchmark-pack`      | Scenarios + mutation guards              | required    | required   |
| `ingestion-adapter`   | Normalised evidence + claims             | optional    | required   |
| `cognition-module`    | Reasoning surface (e.g. disagreement)    | required    | required   |
| `organization-policy` | Role-environment fit + mismatch rules    | required    | required   |

## Common shape

Every manifest extends `ManifestBase`:

```ts
interface ManifestBase {
  id: string;            // e.g. "@scope/name"
  kind: ManifestKind;
  name: string;
  description: string;
  version: string;       // semver
  frameworkVersion: string; // semver range against FRAMEWORK_API_VERSION
  author?: string;
  homepage?: string;
  license?: string;
}
```

`isCompatibleFrameworkVersion()` accepts `^x.y.z`, `~x.y.z`, `x.y.x`, and
exact `x.y.z`.

## `benchmark-pack`

```ts
interface BenchmarkPackManifest extends ManifestBase {
  kind: "benchmark-pack";
  scenarioIds: string[];
  mutationGuardNames: string[];
  deterministic: true;   // refusal: non-deterministic packs are not loadable
}
```

Scenarios must produce byte-stable traces. Mutation guards must fail
loudly. The framework validates these contracts at registration time
via `validateManifest()`.

## `ingestion-adapter`

```ts
interface IngestionAdapterManifest extends ManifestBase {
  kind: "ingestion-adapter";
  sourceKind: string;            // e.g. "github", "transcript"
  requiredInputs: string[];
  providesProvenance: string[];  // provenance fields guaranteed to be set
  declaresReliability: boolean;  // adapter must declare reliability factors
}
```

Adapters that do not declare reliability factors will not load — the
framework refuses to absorb evidence whose reliability it cannot
attribute.

## `cognition-module`

```ts
interface CognitionModuleManifest extends ManifestBase {
  kind: "cognition-module";
  hook:
    | "confidence-propagation"
    | "disagreement-detection"
    | "uncertainty-fusion"
    | "recommendation-reconciliation";
  emitsProvenance: boolean;
  canChangeRecommendation: boolean;
}
```

A cognition module that does not emit its own provenance nodes will not
load. Silent reasoning is incompatible with the framework's contract.

## `organization-policy`

```ts
interface OrganizationPolicyManifest extends ManifestBase {
  kind: "organization-policy";
  orgStyle: string;        // e.g. "early-chaos", "post-ipo-structured"
  detectors: string[];     // mismatch detector names
  canBlockAdvancement: boolean;
}
```

Policies that can block advancement are surfaced explicitly in the
operator console.

## `plugin`

A `plugin` is a container that registers one or more of the above:

```ts
interface PluginManifest extends ManifestBase {
  kind: "plugin";
  provides: Array<
    BenchmarkPackManifest
    | IngestionAdapterManifest
    | CognitionModuleManifest
    | OrganizationPolicyManifest
  >;
}
```

## Validation

```ts
import { validateManifest } from "@workspace/framework/registry";

const issues = validateManifest(myManifest);
if (issues.length) {
  throw new Error(`manifest rejected:\n${issues.join("\n")}`);
}
```

`validateManifest()` checks intrinsic shape and `frameworkVersion`
compatibility. Domain-specific validation (e.g. that a benchmark pack's
scenarios actually produce stable hashes) is performed by the
respective registries.

## Versioning policy

- The framework follows semver. `0.x` minor bumps may break extensions.
- A manifest declares the **highest** version it tested against. Use
  `^0.1.0` while the framework is on `0.1.z`.
- Mutation guards and provenance contracts are version-pinned and
  surfaced on `/benchmarks-public`.

## What is intentionally not in scope

- Sandboxing of third-party code.
- Authentication of extension authors.
- Network installation of packages from a registry.

These belong to a future production-hardening layer, not the framework
skeleton. See [`design-partners/README.md`](./design-partners/README.md)
for the full list of explicit limitations.
