# Organization intelligence

The `organization_intelligence` module is the framework's model of *the hiring organization itself* — its roles, its team shapes, its calibration history, and the way fit reasoning depends on the org as much as on the candidate.

## Why this layer exists

A candidate is not "a good hire" in the abstract. A candidate is a good hire **for a specific organization at a specific moment**. The same trajectory that thrives at a 30-person founder-mode company plateaus at a 3000-person process-driven one. Fit is a joint function of two graphs, not a one-sided keyword problem.

## Layout

```
lib/framework/src/organization_intelligence/
  context.ts        Per-organization context: stage, role inventory, current needs.
  fit_engine.ts     Joint reasoning over candidate + organization graphs.
  memory.ts         Organization-scoped persistent memory.
  agents.ts         Organization-aware agent wrappers.
  types.ts          Public types.
```

## Organization context

`context.ts` captures what the framework knows about the organization:

- stage (early founder, growth, scale, enterprise),
- active role inventory and where each role sits in the org graph,
- known evidence weights — which signals this organization has historically over- or under-weighted,
- reviewer roster with calibration identities,
- recent hires and outcomes (feeds calibration).

The context is itself a confidence-weighted artifact — the framework never claims to know more about the organization than the evidence supports.

## Fit engine

`fit_engine.ts` is the core reasoning surface. Given a candidate (with their graph + signals) and an organization (with its graph + context), it produces:

- a fit assessment — confidence-weighted, with supporting subgraphs,
- a list of risks specific to the (candidate, org) pair,
- a list of leverage moments where the candidate's trajectory and the org's needs align,
- a recommended next action (open investigation, escalate, request reference, etc.),
- the disagreement record if the fit reasoning surfaces internal conflicts.

The output is never a scalar. It is a structured artifact whose lineage roots back to ingested evidence.

## Organization-scoped memory

`memory.ts` is a façade over the framework's memory layer scoped to an organization. It supports:

- writes scoped to `organization | role | candidate` within the org,
- reads that respect the security layer's visibility rules,
- calibration-aware retrieval (memory entries from miscalibrated reviewers are weighted accordingly).

## Console view

The Organization page surfaces:

- Org context overview (stage, role inventory).
- Fit assessments produced recently with their supporting subgraphs.
- Organization-scoped memory tail.
- Calibration deltas applied at the org level.

## Interaction with other layers

- `ingestion` feeds organization-scoped evidence into this module.
- `cognition` produces signals; the fit engine consumes them.
- `evaluation` updates calibration based on outcomes; the next fit assessment uses the updated weights.
- `collaboration` opens investigations when fit assessments carry low confidence or strong dissent.
- `security` enforces multi-tenant isolation — organization-scoped memory cannot leak across orgs.

## Why this is not "company profile" software

A company profile is static metadata. An organization context is **a moving, calibrated model of how this org thinks about hiring**. The framework's calibration loop is what turns the latter into the former over time — and the moat compounds because the institutional knowledge is structurally captured, not buried in someone's head.
