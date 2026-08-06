# Pi Arena Repository Guidance

## Scope

- This repository is the independent `@arena/pi-arena` Pi extension.
- Keep changes repository-local. Do not stage or commit sibling Arena
  repositories from here.
- The package exports TypeScript source and owns only the `arena_plan` and
  optional `arena_map` tool definitions.

## Read first

1. `README.md` for the package contract and extraction provenance.
2. In the coordination checkout, `../docs/progress/MASTER.md` for current Arena
   status.
3. `../docs/design/repo-structure.md` and
   `../docs/design/ml-data-pipeline.md` for repository and data boundaries.

## Hard boundaries

- `arena_plan` returns a candidate plan to its host. It must never submit
  production actions directly.
- `arena_map` remains read-only and is registered only when `ARENA_MAP_URL` is
  configured.
- Do not add production runtime, tenant control, real-data writes, secrets, or
  machine-specific paths to this repository.
- Production tenant restrictions and single-writer rules in the Arena root
  governance remain authoritative.

## Dependencies and checks

- Every directly imported runtime package belongs in `peerDependencies`.
- The consuming host owns compatible peer versions and lockfile resolution; do
  not invent version pins during extraction maintenance.
- Run `npm run check` after installing peer and development dependencies.
- Run `npm pack --dry-run` after package or source changes.
- Keep the TypeScript check strict and no-emit. `skipLibCheck` is limited to
  third-party declaration files.

## Provenance and licensing

- Preserve the extraction facts recorded in `README.md` when reorganizing
  source.
- Do not add or infer a license from peer dependencies or unrelated sibling
  packages. A `LICENSE` file requires provenance from this source's copyright
  owner or its history.
- Do not publish while the package's license status is unresolved.
