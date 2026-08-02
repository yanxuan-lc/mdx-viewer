# tdd-evidence — fix-s12-structural-criterion

Replace S12's wall-clock ratio criterion with a deterministic structural assertion.
Lane `min`: no spec node in the graph; the input was the task description, and the
verification carrier is the project's existing suite.

## What changed

| file | change |
|---|---|
| `test/fixtures/vite-call-probe/hooks.mjs` | new — ESM loader hook wrapping `vite`'s `build` / `createServer`, recording each call to `$MDXV_PROBE_OUT`. Wrapper list `WRAPPED` also generates the `__mdxvProbedExports` sentinel, so coverage cannot drift from what is actually wrapped |
| `test/fixtures/vite-call-probe/preload.mjs` | new — `--import` entry that registers the hook |
| `test/compile-check.no-build.test.mjs` | new — S12 rewritten as 3 assertions (below) |
| `test/compile-check.perf.test.mjs` | **deleted** — the wall-clock ratio test it replaces |
| `openspec/specs/compile-check/spec.md:247` | requirement's asserted criterion + `Scenario: S12` rewritten |
| `package.json` | `test:unit` gains `compile-check.no-build.test.mjs` (it runs no build, so the lane's stated contract now holds for it) |

Product code: **unchanged**. `bin/mdxv.mjs` was mutated only transiently for the
mutation checks below and restored byte-identically (`diff -q` against a pre-mutation copy).

## Why the old criterion was replaced

`assert.ok(checkMs <= exportMs / 5)` measured a quantity the environment controls:

1. **Perverse incentive** — the denominator is `mdxx`. Slowing the export down makes the
   assertion greener while nothing about `--check` improved.
2. **Insensitive** — recorded ratios were 10.17× / 10.76× / ~10.9× against a 5× threshold,
   so `--check` could double in cost and stay green. It only fired on order-of-magnitude
   regressions, i.e. it was a blunt "did a build happen" detector paying a perf test's cost.
3. **Structurally flaky** — a 354 ms startup-dominated process compared by wall clock against
   a 3.6 s throughput-bound build. Under contention the numerator degrades disproportionately,
   so the ratio collapses. Not fixable by tuning the threshold.

It also ran a full Vite build to obtain its denominator — paying the exact cost it existed
to prove `--check` avoids.

## Assertions

| test | asserts |
|---|---|
| `S12` | `mdxv --check examples/demo.mdx` exits 0 having called neither `build` nor `createServer` |
| `S12 (probe liveness)` | the same probe on the same binary in preview mode records `createServer` — without this the first test goes vacuous if the probe dies |
| `S12 (probe coverage)` | the probe wraps **both** entry points, closing the gap the liveness control alone leaves on `build` |

The liveness control uses preview mode rather than `mdxx` deliberately: starting a dev server
is sub-second, a real build is seconds. The `build` path is therefore covered by construction
(same wrapper generator) plus the coverage assertion, not by an end-to-end call.

## Mutation checks (all three caught, each by the intended assertion only)

| mutation | result |
|---|---|
| `runCheck` made to call `createServer` in `bin/mdxv.mjs` | ✖ `S12` red; other two green |
| probe's `note()` turned into a no-op | ✖ `S12 (probe liveness)` red; other two green |
| `WRAPPED` reduced to `["createServer"]` | ✖ `S12 (probe coverage)` red; other two green |

Restore verified: `grep -c mutant bin/mdxv.mjs` → 0, `diff -q` against backup clean.

## Commands run

| command | result |
|---|---|
| `node --test test/compile-check.no-build.test.mjs` | 3 pass / 0 fail · **0.96 s** (was 6.5 s, and ran a Vite build) |
| `make lint` | exit 0 · 35 .mjs parsed, `sh -n` clean, `mdxv --check examples` 2/0, `--check demo` 2/0 |
| `npm test` | **247 pass / 0 fail** · 29.2 s |
| `npm run test:unit` | **237 pass / 0 fail** · 27.5 s |

> Wall-clock caveat: `npm test` measured 79.9 s earlier in this session and 29.2 s now. Most of
> that gap is Vite cache warmth from repeated `mdxx` runs during investigation, **not** an effect
> of this change. The honest figure attributable here is the S12 file itself: 6.5 s → 0.96 s.

## Backlog

`perf-s12-wallclock-ratio-flaky` → `done` (INBOX now empty; `flow doctor` clean).

## Out of scope — deliberately not done

The broader test-lane re-partition discussed alongside this change (splitting into
fast / cli / build lanes, and the fact that `test:unit`'s "快，无 vite 构建" label is false for
`cli-language`, `cli-output` and `compile-check.cli`, which do run real builds) was **not**
touched. This change only moves the one file whose criterion it rewrote.
