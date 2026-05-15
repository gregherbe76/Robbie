# Documentation

Documentation for the Recruiting Intelligence Framework. If you're new to the project, read in this order:

1. [PHILOSOPHY.md](./PHILOSOPHY.md) — why the framework is shaped the way it is.
2. [../README.md](../README.md) — what the framework is and how to start.
3. [../ARCHITECTURE.md](../ARCHITECTURE.md) — the deep module map.
4. [../QUICKSTART.md](../QUICKSTART.md) — install, build, benchmark, run.

## Topic guides

| Topic | Read |
|---|---|
| The reasoning behind the framework | [PHILOSOPHY.md](./PHILOSOPHY.md) |
| Module layout, data flow, primitives | [architecture/](./architecture/) |
| Cross-agent cognition, synthesis, disagreement | [cognition/](./cognition/) |
| Signal model, lineage, why provenance is data | [provenance/](./provenance/) |
| Evidence ingestion, normalization, reliability | [ingestion/](./ingestion/) |
| Org graph, fit engine, organization-scoped memory | [organization-intelligence/](./organization-intelligence/) |
| Investigations, hypotheses, adversarial probes | [collaboration/](./collaboration/) |
| Calibration, outcomes, longitudinal learning | [evaluation/](./evaluation/) |
| Deterministic benchmark suites and reproducibility | [benchmarks/](./benchmarks/) |
| Identity, isolation, capabilities, audit | [security/](./security/) |
| Worked examples and scenario walkthroughs | [examples/](./examples/) |

## Reference

- HTTP contract: [`lib/api-spec/openapi.yaml`](../lib/api-spec/openapi.yaml) is the single source of truth.
- Generated React Query hooks: `lib/api-client-react/src/generated/`.
- Generated Zod schemas: `lib/api-zod/src/generated/`.
- Framework public exports: [`lib/framework/src/index.ts`](../lib/framework/src/index.ts).

## Contributing to docs

- Keep tone technical and calm.
- Every doc page should be readable in under ten minutes.
- Cross-link liberally; do not duplicate.
- Code examples must compile against the current framework version.
