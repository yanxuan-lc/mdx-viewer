# suite-report — retier-test-lanes

Commit: f1a91666c9ae81e4767f6dd42dd1e7fc57710326

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

Independently of the probe, L1 is now *structurally* incapable of spawning — and the check is on
the **transitive closure**, not just the eight listed files: neither those files nor anything they
import mentions `child_process`, `spawnSync`, `spawn(`, `execSync`, `execFileSync`, `execFile(` or
`fork(`. The closure distinction started mattering the moment `test/helpers/` existed (review #B12):
a file-local check would pass while an imported helper spawned.

Closure here means: start from a lane's listed files, follow every relative `from "./…"` import
transitively. Measured that way — including the `src/` modules the tests import — L1's closure is
**19 files with 0 spawn-API mentions**; L2's is **15** with 4; L3's is 4 with 3.

Two earlier drafts of this line were wrong, in opposite ways, and both are worth recording because
the sentence they sat in claimed to be a first-hand derivation:

- `8 / 5 / 4` — the reviewer's figures, counting only files under `test/`. I reproduced them without
  re-deriving them.
- `19 / 12 / 4` — my own walk, but the L2 figure was wrong: `12` matches no defensible definition
  (transitive incl. `src/` is 15; `test/`-only is 5; lane files plus one hop is 8). The walk that
  produced it silently missed three edges.

The figures above come from a walk that prints its full file list, so the count can be checked
against the members rather than trusted: L2's 15 = 4 lane files + `test/helpers/cli-env.mjs` +
10 modules under `src/`.

**One gap in the measurement above, disclosed rather than papered over** (review #B13):
`test/compile-check.no-build.test.mjs:34` sets `MDXV_PROBE_OUT` to its own temp file for every
subprocess it spawns, and deletes it afterwards.

Precisely what is and is not shadowed (review #B16 — the first wording here said "the injection is
overwritten", which overstated it): `probeEnv()` **preserves and appends** `NODE_OPTIONS`, so the
lane-level loader still loads and the hooks still run. Only the single variable `MDXV_PROBE_OUT` is
redirected. That matters for how cheap the fix is — **a distinct output variable name closes it**;
no change to the probe architecture is needed.

Consequences while it stands: L2's true `createServer` count is **5**, not 4 (4 from
`cli-language`'s mdxv matrix, plus 1 from that file's own probe-liveness control), and L2's
load-bearing `build = 0` is **not established by this table** for that one file.

It is, however, established more strongly than an earlier draft of this paragraph claimed: that file
asserts the *complete* call list with `deepEqual` at all three of its subprocess sites — `--check`
asserts `[]`, the liveness control asserts **exactly** `["createServer"]` (which therefore excludes
`build`), and probe-coverage asserts `[]`. So no build can hide there. The earlier wording said it
rested on "that file's own S12 assertion", which read as weaker than it is.

Nothing asserts this invariant in the suite itself; tracked as `test-lane-invariant-unguarded` (P2),
whose criterion has to account for this shadowing to be worth implementing.

## Membership check

15 test files matched by the gate's glob, 15 covered across the three lane lists, no file in two
lanes, none missing — verified programmatically against `package.json`. `test/helpers/cli-env.mjs`
is deliberately not `*.test.mjs`, so the glob does not collect it as a test file; `make lint` still
parses it.
