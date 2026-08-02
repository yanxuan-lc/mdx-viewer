# suite-report — retier-test-lanes

Commit: 0afc3edb827bf83cbda67e085ad3268bbacc9e7e

The minimal lane's verification carrier: the project's own suite, run whole. Numbers below are
measured at the commit stamped above — **not carried over from an earlier round**. Round 1 of this
file did exactly that (stamp advanced, numbers stale), which review caught as P1 #A3.

## Result

Recorded as **exit code + all four counters**, not just `pass` / `fail`. Reason (review P2 #B9):
when a `describe()`-scoped `before()` hook throws, node:test reports its tests as
**`cancelled`, not `fail`** — so a broken shared fixture yields `pass 2 / fail 0`, which reads
green while the real exit code is 1. Copying only the pass/fail line into evidence would transcribe
a red run as green.

| command | exit | tests | pass | fail | cancelled | skipped | wall |
|---|---|---|---|---|---|---|---|
| `npm test` (full gate, `test/*.test.mjs` glob) | **0** | 247 | 247 | 0 | 0 | 0 | 24.8 s |
| `npm run test:unit` (L1) | 0 | 185 | 185 | 0 | 0 | 0 | **0.5 s** |
| `npm run test:cli` (L2) | 0 | 46 | 46 | 0 | 0 | 0 | 8.6 s |
| `npm run test:build` (L3) | 0 | 16 | 16 | 0 | 0 | 0 | 23.6 s |
| `make lint` | **0** | — | — | — | — | — | — |

185 + 46 + 16 = 247, which is also the count before this change — every test was moved, none
dropped or duplicated.

## Lane invariant, measured on both dimensions

The criterion has two halves, **build and spawn**. Round 1 measured only the first and asserted
the second, which is how P1 #A1 (an L1 file spawning four subprocesses) got through.

| lane | build | createServer | spawn |
|---|---|---|---|
| `test:unit` | 0 | 0 | **0** |
| `test:cli` | 0 | 4 (dev servers — L2 by definition) | 39 |
| `test:build` | 11 | 0 | 6 |

Two separate loader probes: `test/fixtures/vite-call-probe` (committed, built for S12) counts
`vite.build` / `createServer`; a `child_process` wrapper counts subprocess creation. **They must be
injected in separate runs** — combining both in one `NODE_OPTIONS` silently zeroed the vite counts
(measured, not assumed).

Independently of the probe, L1 is now *structurally* incapable of spawning: none of its eight files
mentions `child_process`, `spawnSync`, `spawn(`, `execSync`, `execFileSync`, `execFile(` or `fork(`.

Nothing asserts this invariant in the suite itself; tracked as `test-lane-invariant-unguarded` (P2).

## Membership check

15 test files matched by the gate's glob, 15 covered across the three lane lists, no file in two
lanes, none missing — verified programmatically against `package.json`. `test/helpers/cli-env.mjs`
is deliberately not `*.test.mjs`, so the glob does not collect it as a test file; `make lint` still
parses it.
