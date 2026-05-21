# Publishing to npm

The repo ships two publishable packages:

| Package | Path | What it is |
|---|---|---|
| `@robbie/framework` | `lib/framework` | The framework library. |
| `@robbie/memory-postgres` | `lib/integrations/memory-postgres` | Postgres-backed `MemoryStore` adapter. |

Everything else in the repo (`@workspace/api-server`, `@workspace/console`, `@workspace/scripts`, `@workspace/examples`, `@workspace/db`, `@workspace/api-spec`, `@workspace/api-client-react`, `@workspace/api-zod`, `@workspace/mockup-sandbox`) is `private: true` and never published.

## Prerequisites

1. **npm account** with two-factor enabled.
2. **Scope claim**: `npm access` must show `@robbie` is owned by you (or your org). If not yet claimed, run `npm publish` against the unscoped name first or claim the scope at <https://www.npmjs.com/settings/~/packages>.
3. **Clean working tree** on the branch you're publishing from.
4. **Builds green**: `pnpm run typecheck` and `pnpm -w run benchmark:cognition` both pass.

## Steps

```bash
# 1. Verify a clean build from scratch.
rm -rf lib/*/dist lib/integrations/*/dist
pnpm install
pnpm run typecheck
pnpm -w run benchmark:cognition

# 2. Dry-run pack to inspect tarball contents.
cd lib/framework && pnpm pack && tar tzf robbie-framework-*.tgz | head -20 && cd -
cd lib/integrations/memory-postgres && pnpm pack && tar tzf robbie-memory-postgres-*.tgz && cd -

# 3. Publish, one at a time.
cd lib/framework
npm publish --access public
cd -

cd lib/integrations/memory-postgres
npm publish --access public
cd -

# 4. Tag the release.
git tag v0.1.0
git push origin v0.1.0
```

The `--access public` flag is required for the initial publish of a scoped package because npm defaults scoped packages to private.

## What gets shipped

Each package's `files` array in `package.json` is the allowlist. The current allowlist is:

**`@robbie/framework`**: `dist/`, `README.md`, `LICENSE`
**`@robbie/memory-postgres`**: `dist/`, `schema.sql`, `README.md`, `LICENSE`

`src/`, `tests/`, `benchmarks/`, `tsconfig.json`, `node_modules/`, `.github/`, and everything else in the repo are excluded.

The `prepublishOnly` script rebuilds `dist/` automatically before publishing — you do not need to run `tsc` manually.

## Version bumps

Until 1.0, breaking API changes can land in minor versions. Patch is reserved for bug fixes. Both packages move together — `@robbie/memory-postgres@0.x.y` is only expected to work against `@robbie/framework@0.x.*`.

To bump both:

```bash
# Replace 0.1.1 with the target version.
pnpm --filter @robbie/framework exec npm version 0.1.1
pnpm --filter @robbie/memory-postgres exec npm version 0.1.1
git add -A && git commit -m "chore: release 0.1.1"
```

## Status banner

The framework README states "0.1 pre-release. Semantic versioning kicks in post-1.0." Keep this language until 1.0.
