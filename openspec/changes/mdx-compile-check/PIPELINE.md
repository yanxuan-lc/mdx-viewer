# Pipeline — mdx-compile-check

archetype: feature
criticality: supporting
reversibility: reversible
ceiling: auto+spot-check
gate-shape: async spot-check + publish-consent (publish deferred by user)
intensity: adversarial-N=1; design-it-twice=off; verifier-tier=standard; verifier-model=same-family (light lane; not required); oracles=unit+subprocess; sweep=diff-scoped; token-budget=n/a
infra-readiness: off
escalations: []
anomaly-rate: n/a
budget-B: n/a
downgrade-state: none
started: 2026-07-27T14:35:01Z
completed: n/a

track: feature_generic (full lane — the small variant is barred: `--check` is a NEW external
contract, and a cross-repo consumer will depend on its flag name + exit-code semantics)

- [x] decompose → 2 units; only Unit A enters this pipeline @ 2026-07-27T14:33:59Z
- [x] grill → BRIEF.md (light; behaviour was fully specified & confirmed in conversation) @ 2026-07-27T14:35:01Z
- [x] design-spec → proposal.md + design.md + specs/compile-check/spec.md + tasks.md + REVIEW.mdx (stamp 4900b3d581c8; openspec validate --strict passes) @ 2026-07-27T14:36:03Z → 2026-07-27T14:53:00Z
- [x] arch-review → arch-review.md (VERDICT: revise spec first — 3×P0 + 1 blocking P1) @ 2026-07-27T14:54:41Z → 2026-07-27T15:43:37Z
- [x] design-spec r2 → spec revised: 8 requirements / 19 scenarios; REVIEW.mdx stamp d9ad1f50eac1; validate --strict passes @ 2026-07-27T15:43:37Z → 2026-07-27T16:03:13Z
- [x] arch-review r2 → GO; all 3 planner deviations accepted (2 judged better than the reviewer's own proposals); F1/F2/F3/F4/F11 resolved, F6 partially + 1 new P2 @ 2026-07-27T16:03:13Z → 2026-07-27T16:10:08Z
- [x] design-spec r3 → S17 deleted, seam prohibited in R4/design/tasks; D7 rewritten; 8 requirements / 18 scenarios; REVIEW.mdx stamp f3a74ce317a4 @ 2026-07-27T16:10:08Z → 2026-07-27T16:18:47Z
- [x] implement → src/cli/compile-check.mjs + output/messages/bin wiring; 25 unit tests; tdd-evidence.md; npm test 118/118 (controller-verified) @ 2026-07-27T16:18:47Z → 2026-07-27T16:45:37Z
- [x] e2e-author → e2e-manifest.md **status: final**; 18/18 PASS; S7 strengthened with real proof (exit-0 assertion + post-exit TCP ECONNREFUSED, not an inference from matching output); stamp 'uncommitted at base 15433c9' @ 2026-07-27T16:18:47Z → 2026-07-27T16:51:00Z
- [ ] implement → product code + unit tests + tdd-evidence.md
- [ ] e2e-author → e2e-manifest.md (scripted carrier: subprocess CLI tests, not Playwright — no browser surface)
- [x] security-gate → security-scan-report.md: Critical/High/Medium = 0; 1 Low (no compile timeout), 4 Info. dep-audit tool-verified clean; secret-scan degraded (no gitleaks) but full-history; **SAST tool NOT run** (none installed) — manual targeted review substituted and labelled as such @ 2026-07-27T16:51:00Z
- [-] a11y-gate → no browser UI surface @ 2026-07-27T14:35:01Z
- [x] perf-gate → perf-report.md: **10.1x faster than `mdxx`** (budget >=5x) PASS; test:unit stays fast PASS; marginal cost flat-to-declining 9.3->5.6->5.2 ms/doc over 10/25/50 docs — no accumulation @ 2026-07-27T16:51:00Z
- [x] e2e-run → e2e-report.md: **18/18 scripted PASS, 1/1 perf PASS (ratio 10.83x), npm test
      118/118 PASS, no regression**; coverage 18/18 spec scenarios (S17 confirmed absent, not a
      gap); db-assert n/a throughout (no DB in this project); S7's strengthened assertions
      (`status===0` + post-exit TCP ECONNREFUSED) read and confirmed genuinely present in the test
      body; `.md`/`.mdx` asymmetry, exact trigger position, and zero-ANSI stream split
      independently re-run outside the suite and all hold; stamp: uncommitted at base 15433c9
      @ 2026-07-27T16:51:00Z → 2026-07-28T00:00:00Z
- [x] e2e-run (fix-verification re-run) → e2e-report.md **re-stamped, supersedes prior**: after
      #A1 (check-mode detection fix: `--check`/`--check=true` now correctly exit 2 on an
      argument-level failure, `--check=false` stays preview) and #A3 (tier-B help text rewritten
      to mechanism-plus-examples) plus new **S20**, re-ran full suite: **19/19 scripted PASS
      (cli.test.mjs), 1/1 perf PASS (ratio 10.17x), npm test 122/122 PASS** — matches controller's
      own count exactly; coverage 19/19 spec scenarios (S17 still confirmed absent); S20 test body
      audited line-by-line — real subprocess exit-0 assertions on both `mdxv --check` and `mdxx`
      against two dedicated throw-shape fixtures, would fail if either command started detecting
      these, not vacuous; #A1 spot-checked end-to-end (`--check --lang bogus` → 2, `--check=true
      --lang bogus` → 2, `--check=true` valid `.md` → 0, `--check=false` genuinely starts the real
      preview server); `.md`/`.mdx` asymmetry and zero-ANSI stream split re-verified against the
      changed `bin/mdxv.mjs`, both hold unchanged; stamp: still uncommitted at base 15433c9
      @ 2026-07-28T00:05:00Z → 2026-07-28T00:35:00Z
- [x] code-review → code-review/CHECKLIST.md: **Verdict A (spec-compliance) HELD; Verdict B (code-quality) HELD**; 0 P0, 0 P1, 5 P2, 4 P3 @ 2026-07-27T16:51:00Z → 2026-07-27T17:07:30Z
- [x] spot-check (controller hands-on, recorded below) @ 2026-07-27T17:38:51Z ⟦async human sample⟧
- [ ] merge → dev (auto on green machine gates)
- [-] canary → project has no CD/telemetry (infra-readiness: off) @ 2026-07-27T14:35:01Z
- [x] docs-sync → AGENTS.md (command tables + dir tree + glossary term) / README.md / README.zh-CN.md @ 2026-07-27T17:38:51Z
- [ ] merge -> dev   **BLOCKED ON USER CONSENT** (project CLAUDE.md forbids committing without an explicit request; the track's auto-merge is overridden by that instruction)
- [ ] archive        (after merge)
- [ ] publish ⟦human consent⟧ — DEFERRED by user this round; skill side can be written against
      the contract first, released when the user says so

manual: none
waived: none

## Unit DAG (recorded for traceability; only Unit A runs here)

units:
  - id: A  archetype: feature  criticality: supporting  ceiling: auto+spot-check
           scope: mdx-viewer — add `mdxv --check <file|dir>`
  - id: B  archetype: n/a (skill authoring — NOT a development track per CLAUDE.md)
           scope: excalivibe — mdx-artifact skill gates delivery on `mdxv --check`
           track: skill-creator (separate; no PIPELINE.md)

edges:
  - kind: contract-dependency  from: A  to: B  action: sequence
    note: B hardcodes A's flag name + exit codes; A's CLI contract must be final first.

## Decisions taken with the user (2026-07-27)

1. Input scope = **file + directory** (dir → recursive scan, per-file report, exit 1 if any fails).
2. **No release this round** — run to merge/archive/docs-sync; `publish` stays pending.

## Planner open questions — resolved 2026-07-27T14:54:41Z

All four resolved **as already specified**, so the spec needed no revision and the
`REVIEW.mdx` fingerprint `4900b3d581c8` stays valid (planner not re-dispatched).

| Q | Resolution | Decided by |
|---|---|---|
| Q1 report stream | report → stdout, `Error:` → stderr (deliberate divergence from `formatPreviewSuccess`/`formatExportSuccess`, which stay on stderr) | **user** |
| Q2 summary line | print only when the document set holds >1 document — matches the sample the user confirmed at intake | controller |
| Q3 reason text | full, untruncated (the tail is the actionable fix hint; prefix-grep still matches) | controller |
| Q4 unreadable file | exit 1, not 2 (the gate's promise is violated; every other document *was* checked) | controller |

## arch-review round 1 — routing 2026-07-27T15:43:37Z

Verdict ❌ revise-first. Blocking: **F1** (`.md` compiled as MDX → false failures; controller
independently reproduced: reused `createProcessor` FAILS a `.md` file that the real pipeline
accepts), **F2** (colour derived from `process.stderr.isTTY` while D3 puts the report on stdout →
ANSI leaks into a redirected report), **F3** (`--lang bogus` exits 1 via `resolveCliArguments`
before check-awareness → reads as "document broken"), **F4** (openability guarantee overclaimed).
Bound to F4: **F6** (engine-load failure must exit 2) and **F11** (`--check demo` document count).

**OQ1 resolved by user: 方案甲 — `--check` stays compile-only.** User accepted compile-only
explicitly; no specifier-resolution widening this round.

**Controller correction folded in (user-raised, then verified):** a fenced-code-block `import`
is inert text — `mdxx` exits 0 on a doc whose ```js fence contains `import`, and exits 1 only for
a top-level ESM `import` in the body. So the boundary must say **top-level ESM import statement**,
never "import". Corollary for any future widening: a specifier check MUST read `mdxjsEsm` AST
nodes, never text-grep `^import` — a text grep would false-fail every document that documents JS
code (the F1 error class again).

## Controller independent verification of the r2 spec (2026-07-27T16:03:13Z)

Not taken on the planner's word — reproduced locally before routing:

- **F1 fix (option C, `compile({path, value}, mdxOptions())` per document) is correct.** Per-extension
  behaviour now matches the real pipeline: line-start `<a|b|c>` → `.md` OK / `.mdx` FAIL; bare
  `<not_a_tag>` → `.md` OK / `.mdx` FAIL; malformed JSX → `.md` OK / `.mdx` FAIL. The old spec's
  cached-processor requirement failed the `.md` column, i.e. false failures on `README.md`.
- Spec text confirms F2 (per-stream `resolveCheckColors`), F4 (two tiers; tier B worded as
  *top-level ESM statement*, fenced code explicitly inert), F5 (`process.exitCode` + normal return),
  F3 (`--lang` invalid/valueless/repeated → 2), F11 (S16 pins `demo` at exactly 2 documents),
  F6 (only failures raised outside per-document compilation route to 2).
- `openspec validate mdx-compile-check --strict` → valid.

**Why a second review round on a light lane:** the intensity vector says escalate only on
disagreement, and there is disagreement — the planner deliberately deviated from the reviewer on
three findings (F1 option C, F2's extra named export, F6's narrowed scope). Each deviation is
reasoned in design.md; a focused re-review is the specified response, not gold-plating.

## arch-review r2 — GO with one pre-implementation text fix (2026-07-27T16:10:08Z)

Verdict GO. Deviations: F1 option C **accepted, better** (reviewer re-ran the measurement: ~1.6 ms/doc
marginal, ~80 ms over 50 docs; per-doc times flat-to-declining, so its round-1 scaling worry did not
materialise); F2 `resolveCheckColors` **accepted, better** (matches the existing unit-tested
`isColorEnabled({isTTY, env})` seam); F6 narrowing **accepted**.

**Reviewer corrected its own round-1 reasoning:** it had claimed engine failures on exit 1 make F4's
guarantee false. Too strong — check and real pipeline **share `plugins.mjs`** (the CLAUDE.md
dual-path shared file), so if graphviz-wasm cannot load, `mdxv`/`mdxx` cannot compile that document
either. "fail ⇒ definitely unopenable" holds; what degrades is *attribution*, not the guarantee.

**New P2 routed back before implementation (controller's call, against the reviewer's non-blocking
label):** option C hollowed out F6's trigger surface — under `compile({path, value})` the processor
is constructed per call and `getGraphviz()` / shiki's highlighter initialise *inside* per-document
compilation, so "failures outside per-document compilation" is nearly empty, `CompileEngineError`
cannot fire in production, and **S17 is only passable via the injected `compileDocument` seam** —
a scenario asserting a path reality cannot reach. Left as-is it would ship a vacuous test counted as
coverage in `e2e-manifest.md`, and possibly a production seam existing only to satisfy it. Text-only
fix, so it is cheaper to correct now than to have `developer` build the seam and `e2e-author` script
the vacuous case. Routed to planner rather than edited by the controller because editing spec.md
directly would stale the `REVIEW.mdx` fingerprint.

**Deferred to later gates, not blocking:** S11 pins colour *logic* not *wiring* (unfalsifiable
without a pty; reviewer routed it to code-review as an explicit two-line read) and marginal per-doc
cost is unasserted (perf-gate to record a ≈4 ms/doc baseline).

## Design gate closed — implement dispatched 2026-07-27T16:18:47Z

Controller verification of the r3 spec: `openspec validate --strict` valid; 18 scenarios; S17 absent;
`REVIEW.mdx` contains exactly one 12-hex string (`f3a74ce317a4`) so fingerprint extraction cannot
mismatch; `tasks.md 1.5` is a negative instruction carrying its root cause, so `developer` reading it
in isolation will not rebuild the prohibited seam. No third arch-review round: the r3 change was
text-only and in the direction the reviewer itself recommended, so there is no disagreement left to
escalate (light lane, adversarial-N=1).

**File ownership partition (no two agents on one file):**

| Owner | Files |
|---|---|
| `developer` | `src/cli/compile-check.mjs`, `src/cli/output.mjs`, `bin/mdxv.mjs`, `src/i18n/messages.mjs`, `test/compile-check.test.mjs`, `test/fixtures/compile-check/`, `package.json`, `Makefile` |
| `e2e-author` | `test/compile-check.cli.test.mjs`, `test/compile-check.perf.test.mjs`, `test/fixtures/compile-check-e2e/`, `e2e-manifest.md` |

`e2e-author` must NOT edit `package.json` / `Makefile` (developer-owned) — it reports required
registrations in `e2e-manifest.md` instead. Single-phase: the carrier is subprocess CLI, so there is
no app-boot boundary and no Phase-2 DOM continuation.

## e2e-author phase 1 landed (2026-07-27T16:31:24Z)

Carrier: subprocess CLI (`node --test`, zero third-party deps), single-phase — no app-boot boundary.
Coverage 18/18 mapped, S17 correctly not resurrected, no vacuous assertions: the one apparent GREEN
(S7) was flagged as passing for the wrong reason (both invocations failing identically at
argument parsing) and deliberately excluded from validated coverage. Fixture expectations were
derived independently from the real `@mdx-js/mdx` `compile()` + real `bin/mdxx.mjs`, never from the
implementation — so a fixture/implementation disagreement favours the fixture.

Two registrations routed to `developer` (it owns `package.json`): add
`test/compile-check.cli.test.mjs` to `test:unit`; keep `test/compile-check.perf.test.mjs` OUT of it
(finding F9 — otherwise `make test-unit` silently becomes multi-second).

Deferred as designed: S11 pins the `resolveCheckColors` pure-function contract; whether
`bin/mdxv.mjs` is actually wired to `.report`/`.diagnostic` is a code-review two-line read (a real
subprocess cannot reach it without a pty, and this repo has no third-party test deps).

## implement landed — controller hands-on verification (2026-07-27T16:45:37Z)

Not taken on the developer's word. Re-ran and exercised the real CLI myself:

| check | result |
|---|---|
| `npm test` | **118/118 pass** (25234 ms) |
| zero-diff constraint | `src/mdx/plugins.mjs`, `src/cli/vite-config.mjs`, `bin/mdxx.mjs`, `src/cli/resolve.mjs` — all clean |
| original triggering document (fixed) | exit 0 |
| same document reverted to the incident wrap | `✗ …:115:8  Unexpected character \`|\` (U+007C) in name…` exit 1 — the exact position originally found by hand |
| same content `.md` / `.mdx` | exit 0 / exit 1 — F1's false-failure class genuinely closed |
| `--check demo` | both `demo/index.mdx` and `demo/index.zh-CN.mdx`, `2 passed, 0 failed`, exit 0 |
| exit tiers | `--lang bogus` → 2, missing path → 2, broken document → 1 |
| stream split, redirected | report entirely on stdout, stderr empty, **0 ANSI sequences** in the captured report |
| usage error | stdout exactly 0 bytes, `Error:` on stderr |

Outstanding, routed not dropped:
- `tasks.md` §5.3 (docs-sync: `AGENTS.md` / `README.md` / `README.zh-CN.md`) was outside the developer's
  file-ownership list and is correctly deferred to the docs-sync tail node.
- `e2e-author` continued to re-run its suite, re-assess S7 (was flagged apparent-green for the wrong
  reason), and flip `e2e-manifest.md` to `status: final` with an honest uncommitted-at-15433c9 stamp.
- **Unrelated to this change:** the developer wrote `.claude/agent-memory/` into the repo (its own
  dispatch-experience notes). Harness scaffolding, not part of the change — must not be folded into it.

## Machine gates - controller-run, both PASS (2026-07-27T16:51:00Z)

**security-gate.** dep-audit genuinely tool-verified (`npm audit` via the official registry -
the project's default mirror returns NOT_IMPLEMENTED for that endpoint - `found 0
vulnerabilities`). **SAST was NOT run by any tool** (semgrep/njsscan/osv-scanner all absent;
installing semgrep is disproportionate to a 74-line module) - a targeted manual review was
substituted and the report says so explicitly rather than reporting clean. Secret scan degraded
(no gitleaks) but run over **full history**, not just the diff: 39 word-level false positives
("语义 token", docs describing "读 .env token"), zero key=realvalue shapes, `.env` never
committed, `.gitignore:8-9` covers it.

**The security property that actually matters, verified empirically:** compiling does NOT
evaluate document code. A document with a throwing top-level `export` initializer, a throwing
expression, a throwing component prop, and an `execSync("touch ...")` call all report a pass at
exit 0 with **no side effect on disk**. MDX parses expressions with acorn and emits them as
source; frontmatter YAML uses the safe default schema. This is what makes the gate safe to run
unattended on machine-generated documents, and it is now a regression-relevant invariant: any
future change that evaluates document content at check time is a privilege escalation.

**perf-gate.** 359 ms vs `mdxx` 3627 ms = **10.1x** (budget >=5x). Marginal cost measured over
10/25/50 documents is **flat-to-declining (9.3 -> 5.6 -> 5.2 ms/doc)** - no accumulation, which
independently confirms the architectural claim behind the F1 fix (warm-up lives in module-level
caches, not the processor object, so dropping "build once" cost nothing).

Carried forward to code-review as explicit reads: S11's colour **wiring** (which stream each
`colorize` call consults - unfalsifiable without a pty, and this repo has zero third-party test
deps), and whether tier B's wording should name a third shape - a top-level `export` whose
initializer throws passes `--check` and then fails at module evaluation.

## code-review + e2e-run — both green (2026-07-27T17:07:30Z)

**e2e-run** (`e2e-report.md`): 18/18 scenarios executed and passing; `npm test` 118/118; perf ratio
10.83x this run. It audited S7's test *body* as instructed rather than trusting the green — the two
claimed strengthenings are genuinely present at `test/compile-check.cli.test.mjs:172` (explicit
`status === 0`) and `:179-183` (post-exit TCP connect asserting ECONNREFUSED/ETIMEDOUT). It also
re-verified the three highest-value properties independently outside the suite, including a
byte-level scan finding zero ESC bytes in the redirected report. S17 confirmed absent from spec,
manifest, and both test files - a deliberate deletion, not a coverage gap.

**code-review**: both verdicts HELD, zero P0/P1. The two routed reads came back:
- **S11 colour wiring is correct, not crossed** - all four call sites read individually: report line
  at `bin/mdxv.mjs:176` uses `console.log` (stdout) with `.report`; the three `Error:` diagnostics use
  `console.error` (stderr) with `.diagnostic`; the summary line is unstyled. So F2 holds at the
  wiring layer, not merely in the pure function.
- **Boundary wording (#A3)**: judged NOT a spec violation - the help preamble already says
  compile-only, and R6's literal requirement is met - but the two-item enumeration is unmarked as
  exemplary and so supports the false inference "my document has no import and no expression,
  therefore pass = deliverable", which is the very thing R6 exists to prevent. Reviewer parked
  fix-now-vs-track as an open question.

Constraints all re-verified independently: zero diff on `plugins.mjs` / `vite-config.mjs` /
`resolve.mjs` / `bin/mdxx.mjs`; zero repo-wide hits for `CompileEngineError`, `compileDocument`,
`createProcessor` (and the reviewer agrees they should NOT come back - D7's empty-set argument
holds); no cached processor; `compile-check.mjs` touches no stream/process/locale/formatting;
check paths only set `process.exitCode`.

### P2 disposition

| # | Finding | Routed to |
|---|---|---|
| A1 | `--check=true` spelling bypasses the bare-argv probe -> argument-level failure exits **1 not 2**, a literal R4/S6 deviation on the cross-repo contract | `developer` (fix + test) - **fixing before merge** |
| B1 | three dead imports at `test/compile-check.test.mjs:10`, invisible with no linter in the repo | `developer` - fixing |
| A2 | `design.md:146,148-150` exit-2 list **contradicts its own D7** (still routes engine failures to 2); code follows spec.md and is correct, but the stale sentence would mislead a future maintainer into wiring it | `planner` - fixing |
| A3 | tier B enumeration reads as a closed set | **user chose fix-now**: generalise to mechanism + examples -> `planner` (spec) then `developer` (help text + bilingual catalogue) |
| A4 | docs-sync gaps: `AGENTS.md` command table lacks `make check-mdx`, glossary lacks the new term, both READMEs mention `--check` **zero** times while `package.json` `files` ships them | the `docs-sync` tail node (controller). Reviewer suggests gating **publish** rather than merge - publish is deferred anyway |

Reviewer's own stated limits, recorded rather than glossed: its report is one input to the merge
decision and does not adjudicate the security/perf gates; its `Commit` field is an
uncommitted-tree content digest (`sha256:4baa8339549e7573`) that must be re-checked once a merge
candidate commit exists; and **it does not constitute the post-merge unbiased audit**, which
requires a different model family it cannot self-certify.

## P3 round + docs-sync + spot-check (2026-07-27T17:38:51Z)

**Delta review verdict: both verdicts still HELD, merge gate HELD**, 3 new findings all P3. The
reviewer diffed the shipped #A1 predicate against cac's actual parse across 13 spellings - they agree
on all 13 - and recorded that its own round-1 regex suggestion would have broken `--check=false`, so
the developer was right to decline it. It also validated S20 independently by running `evaluate` +
`react-dom/server` rather than trusting the fixtures.

Two P3s fixed (both test-only, no product code, no spec change):
- **#B6** the boundary help text was asserted for `en-US` only; the `zh-CN` wording - the primary
  audience language - had no content assertion, so it could silently drift back to a closed-set
  enumeration. Mirrored assertions added, with a red proof. The developer additionally established
  which markers actually discriminate ("top-level ESM statement" + "examples, not an exhaustive
  list") versus which stay true against the bad wording too - ruling out an assertion that passes by
  accident.
- **#B7** S20 had no guard that its fixtures still throw; a "fixed" fixture would leave the scenario
  silently vacuous while still reporting as coverage. A witness assertion now pins the exact stage
  each fixture fails at (evaluation / render), using only dependencies the repo already has.

**#B5 deliberately NOT fixed** (recorded, not silently dropped): `mdxv --lang xx-XX -- --check`
exits 2 where the contract implies 1. The `--` terminator has no established semantics for `mdxv`,
was never advertised, and the impact is confined to 1<->2 on the argument-error path. Also left:
**#A5** (stale file list in design.md), #B2-#B4.

**No third full review round after these two P3 fixes**, and the reasoning is recorded rather than
left as an unexplained omission: both are test-strengthening only - no product code, no spec text -
and the merge-gate rule runs the oracle once per candidate unless a stamp mismatches or there is a
concrete suspicion. The controller verified the result directly instead (below).

### Controller spot-check (hands-on, final tree)

| check | result |
|---|---|
| `npm test` | **123/123 pass**, exit 0 |
| both S20 fixtures genuinely throw, verified outside the suite via `evaluate` + `renderToStaticMarkup` | `throwing-initializer` at **evaluate**, `throwing-expression` at **render** - both as claimed |
| `messages.mjs` restored after the transient red proof | diff is **+6 lines only** (3 keys x 2 locales); no existing message altered; no stray backup files |
| rendered `zh-CN` help | all four load-bearing markers present; no regression to bare `import` |
| zero-diff constraint | `plugins.mjs` / `vite-config.mjs` / `bin/mdxx.mjs` / `resolve.mjs` still clean |
| dogfood: `make check-mdx` on the three docs just edited | `README.md` / `README.zh-CN.md` / `AGENTS.md` all pass, exit 0 - exercises the `.md` format path end to end |
| `make help` lists the new target | yes |
| #A4 closed | README `--check` mentions went 0 -> 3 in each README |

### docs-sync detail

`AGENTS.md`: `make check-mdx` row in the make table; a `mdxv --check` row in the direct-invocation
table carrying the exit-code contract and the stream split; `src/cli/compile-check.mjs` in the
directory tree; and a new glossary entry for **compile check** recording the two facts most likely
to be lost - that `format` is derived per extension so a single cached processor must not be reused,
and that the pass/fail boundary is two-tiered with the evaluation-time tier invisible to `mdxx` too.
`README.md` / `README.zh-CN.md`: two usage lines plus a boundary paragraph in each, phrased as
mechanism-plus-examples with the fenced-code exemption.
