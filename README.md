# @arena/pi-arena

`@arena/pi-arena` is a source-distributed Pi extension for Arena Hero. It
registers Arena-specific tools with Pi while leaving game-state ownership,
validation, and production submission to the consuming Arena runtime.

## Tools

| Tool | Behavior |
| --- | --- |
| `arena_plan` | Returns one candidate tick plan to the host and terminates the Pi turn. It does not submit actions to production. |
| `arena_map` | Optionally queries the host's read-only `/map/query` endpoint for map statistics, known obstacles, or allies. It is registered only when `ARENA_MAP_URL` is set. |

The map request has a five-second timeout so the host retains time to validate
and process the plan.

## Runtime contract

The package exports `src/index.ts` directly and therefore requires a Pi host
that can load TypeScript extensions. Its direct runtime peer dependencies are:

- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-tui`
- `typebox`

Peer versions are intentionally not pinned in this extracted package. The
consuming host owns compatible versions and its lockfile. `ARENA_MAP_URL` is
the only extension-specific environment variable.

## Build and checks

This repository has no generated build output or dependency lockfile. Its
minimal no-emit TypeScript check uses the TypeScript and Node type ranges
already established by the consuming Arena TypeScript host. After installing
the peer and development dependencies, changes should pass:

```bash
npm run check
npm pack --dry-run
```

`skipLibCheck` isolates this package's check from declaration-file issues in
the Pi dependency tree; the extension's own source remains under `strict`
checking.

## Arena coordination

This is an independent repository, not a package managed by the Arena root
repository. In the coordination checkout, project status and boundaries live
in the sibling root documentation:

- [`../docs/progress/MASTER.md`](../docs/progress/MASTER.md)
- [`../docs/design/repo-structure.md`](../docs/design/repo-structure.md)
- [`../docs/design/ml-data-pipeline.md`](../docs/design/ml-data-pipeline.md)

Those documents establish that the TypeScript runtime owns production actions
and real-data writes. This extension only exposes Pi tools to that host.

## Extraction provenance

The source was extracted without Git ancestry from `packages/pi-arena` in the
Arena TypeScript repository. The original extension was introduced by commit
`fbb1d262467d7034be919ac6f8bb44bd8e416364`; the map schema was corrected by
`2f53d863ebc578cadc2ed78e742292c40436382d`. The four files in this repository's
initial commit `f685051494242e844e19b39ebc1f0cc80ee9ebc0` are blob-identical to the
package snapshot at `2f53d863ebc578cadc2ed78e742292c40436382d`.

## License status

No license was included in the extracted package tree or its original package
metadata, and the independent repository's initial commit did not add one.
Licenses of peer dependencies do not establish a license for this source. No
`LICENSE` file is provided. Current package metadata says `UNLICENSED`, marks
the package `private`, and uses a failing `prepublishOnly` guard to block npm
publication. Publishing or redistribution requires the copyright owner to
establish licensing terms first.
