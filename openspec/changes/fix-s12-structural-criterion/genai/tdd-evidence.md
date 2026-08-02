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

## Mutation checks (all four caught, each by exactly one assertion)

| mutation | result |
|---|---|
| `runCheck` made to call `createServer` in-process | ✖ `S12` red; other two green |
| `runCheck` made to **fork a child process** that calls `build` | ✖ `S12` red; other two green |
| probe's `note()` turned into a no-op | ✖ `S12 (probe liveness)` red; other two green |
| `WRAPPED` reduced to `["createServer"]` | ✖ `S12 (probe coverage)` red; other two green |

Restore verified: `diff -q` against pre-mutation copies of both `bin/mdxv.mjs` and `hooks.mjs`
clean; `git diff --stat bin/mdxv.mjs` empty.

## Review round 1 — P1 fixed

`code-reviewer` returned **NOT HELD** with one blocking finding, independently reproduced here
before acting on it:

**The probe was injected with the `--import` CLI flag, which child processes do not inherit.**
Refactoring `--check` to fork a subprocess that runs the build would therefore have passed S12
silently — and the wall-clock criterion this change removed *would* have caught that, so the new
criterion was strictly weaker on that one regression surface. Reproduced directly:

| injection | child process calling `build({})` |
|---|---|
| `node --import <preload> …` | **not recorded** |
| `NODE_OPTIONS="--import file://<preload>" node …` | **recorded** |

Fixed by injecting through `NODE_OPTIONS` (file: URL, appended to any ambient value rather than
clobbering it). Mutation M2 above is the regression test for it and was red before / green after.

Also from the same review:

- spec said "Wall-clock figures **are recorded** as a budget for the performance gate" — the only
  mechanism that produced those figures was the deleted `console.log`, so the sentence had become
  false. Rewritten; the spec now also names the coverage control, not just liveness.
- `test/compile-check.cli.test.mjs:8` still pointed at the deleted `compile-check.perf.test.mjs`.
- probe hardening: unreachable `includes(MARK)` branch removed; `note()` now names the misuse when
  `MDXV_PROBE_OUT` is unset instead of throwing an opaque `TypeError` from inside the shim.
- liveness control now has an explicit test timeout, keeps the child's stderr, and distinguishes
  "the preview died early" from "the probe is dead" — previously both surfaced as the latter after
  a silent 10 s spin.

Filed to INBOX rather than fixed here: `probe-wrapped-list-vs-repo-vite-surface` (P2) — nothing
pins `WRAPPED` to the repo's actual vite entry surface, so a future import of `createBuilder` /
`preview` / `optimizeDeps` would narrow the probe silently. Verified complete as of today.

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
