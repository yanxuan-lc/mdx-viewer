# TDD evidence — mdx-compile-check

Role: `developer`. Scope actually implemented (per this run's dispatch, which supersedes
`tasks.md`'s original file split — see the note added at the top of §4 in `tasks.md`):

- `src/cli/compile-check.mjs` (new) — `describeCompileFailure`, `checkDocuments`. No third
  export exists (no `CompileEngineError`, no injectable `compileDocument`, per tasks 1.5 / D7).
- `src/cli/output.mjs` — `formatCheckPath`, `formatCheckLine`, `formatCheckSummary`,
  `resolveCheckColors`, plus the `--check` row and `Notes:` boundary paragraph in `formatHelp`.
- `src/i18n/messages.mjs` — `cli.optionCheck`, `cli.checkBoundaryNote`, `cli.checkSummary` in
  both `zh-CN` and `en-US`.
- `bin/mdxv.mjs` — `--check` bare-argv probe before `resolveCliArguments`, `--check` option
  registration, the `runCheck`/`resolveCheckDocuments` wiring, exit-code branching (0/1/2),
  never calling `process.exit()` once inside check mode.
- `test/compile-check.test.mjs` (new, fast lane, registered in `test:unit`).
- `test/fixtures/compile-check/` (new): `pass.mdx`, `broken-jsx.{md,mdx}`, `broken-dot.mdx`,
  `unreadable.mdx`, `tier-b.mdx`, `fenced-import.mdx`, `undefined-component.mdx`,
  `bad-prop.mdx`, `bad-math.mdx`, `full-feature.mdx`.
- `package.json` — `test:unit` now also lists `test/compile-check.cli.test.mjs` (routed to
  this agent by the controller because `e2e-author` cannot edit `package.json`); confirmed
  `test/compile-check.perf.test.mjs` is **not** in that list (F9).
- `Makefile` — new `check-mdx` target (`.PHONY`, and added to the `run` group's help grep).

Not implemented by this agent (outside the dispatch's file-ownership list, reported rather
than done): `openspec/changes/mdx-compile-check/tasks.md` §5.3 docs-sync (`AGENTS.md`,
`README.md`, `README.zh-CN.md`) — none of those files are in "Files you own" for this
dispatch. `test/compile-check.cli.test.mjs`, `test/compile-check.perf.test.mjs`,
`test/fixtures/compile-check-e2e/`, `e2e-manifest.md` are `e2e-author`'s and were only read,
never edited, by this agent.

## Red → green

Before writing `src/cli/compile-check.mjs`, the three exception shapes `describeCompileFailure`
must normalize were reproduced with the real `@mdx-js/mdx` `compile()` + unmodified
`mdxOptions()` via ad-hoc scripts (not committed) — confirming the exact `line`/`column`/
`reason` shapes documented in `design.md`'s D1/D7 tables (VFileMessage-with-position,
VFileMessage-without-position, bare-Error-from-graphviz-with-a-trailing-newline) before any
implementation existed. `test/compile-check.test.mjs` was then written against those confirmed
shapes and the not-yet-existing exports; running it before `compile-check.mjs` existed failed
with `ERR_MODULE_NOT_FOUND`, and after each function was implemented incrementally, the
corresponding test group flipped green. `bin/mdxv.mjs`'s wiring was verified red→green by hand
via `spawnSync`-equivalent shell invocations at each of the S1–S9, S13, S16 scenarios (manual
command transcript kept in this session, not a committed test) before `e2e-author`'s
independently-authored `test/compile-check.cli.test.mjs` was run against the finished code and
found all 18 scenario tests green (see "Cross-checked" below).

## Scenario → test mapping

| Scenario | Covered by | Notes |
|---|---|---|
| S1 | `compile-check.test.mjs` ("S1: a single passing document…") + `compile-check.cli.test.mjs` | content-level + CLI-level |
| S2 | `compile-check.test.mjs` ("S2: …") + `.cli.test.mjs` | |
| S3 | `compile-check.test.mjs` ("S3: …") + `.cli.test.mjs` | |
| S4 | `compile-check.test.mjs` ("S4: …") + `.cli.test.mjs` | |
| S5 | `compile-check.test.mjs` ("S5: …") + `.cli.test.mjs` | |
| S6 | `compile-check.cli.test.mjs` only | argv/process-level, requires spawning `bin/mdxv.mjs` |
| S7 | `compile-check.cli.test.mjs` only | same reason; manually re-verified (see below) that it is a *meaningful* green post-wiring, not the pre-wiring false-green e2e-author flagged |
| S8 | `compile-check.test.mjs` ("S8: …") + `.cli.test.mjs` | |
| S9 | `compile-check.test.mjs` ("S9: …") + `.cli.test.mjs` | |
| S10 | `compile-check.test.mjs` ("S10: …" + help-clause test) + `.cli.test.mjs` | |
| S11 | `compile-check.test.mjs` ("S11: resolveCheckColors …") + `.cli.test.mjs` (locale/marks case + the same pure-function case) | wiring (which `colorize` call reads `.report` vs `.diagnostic`) is explicitly routed to code-review, not tested here — see design.md's disposition |
| S12 | `compile-check.perf.test.mjs` (e2e-author) | slow lane; re-run confirms ratio ≈10.9× ≤ the 1/5 budget |
| S13 | `compile-check.test.mjs` ("S13: …") + `.cli.test.mjs` | |
| S14 | `compile-check.cli.test.mjs` only | needs real `mdxx` subprocess; manually cross-checked against fixtures |
| S15 | `compile-check.cli.test.mjs` only | needs a real piped subprocess |
| S16 | `compile-check.cli.test.mjs` only | needs real `bin/mdxv.mjs demo` argv handling |
| S18 | `compile-check.test.mjs` ("S18: …") + `.cli.test.mjs` | |
| S19 | `compile-check.test.mjs` ("S19: …") + `.cli.test.mjs` | |
| S17 | deleted (D7, second review round) — not resurrected | |
| F12 (onResult contract) | `compile-check.test.mjs`, 3 dedicated tests | not a numbered spec scenario, but an explicit public-surface contract in `design.md` |

## Final test-run results (this agent's commit)

- `node --test test/compile-check.test.mjs` → **25/25 pass**.
- `node --test test/compile-check.cli.test.mjs` (e2e-author's file, run read-only against this
  implementation) → **18/18 pass**.
- `node --test test/compile-check.perf.test.mjs` (e2e-author's file, read-only) → **1/1 pass**
  (`check≈342ms`, `export≈3718ms`, ratio≈10.86×, budget ≤5×).
- `npm run test:unit` (`make test-unit`) → **109/109 pass**, ~24s wall.
- `npm test` (`make test`) → **118/118 pass**, ~26s wall.
- `git diff --stat -- src/mdx/plugins.mjs src/cli/vite-config.mjs src/cli/resolve.mjs bin/mdxx.mjs`
  → empty (zero diff, CLAUDE.md dual-path constraint holds).
- Manual `bin/mdxv.mjs --check` transcript covering S1–S4, S6 (all 7 listed usage failures),
  S7, S8, S9, S13, S16, plus stdout/stderr byte-split verification and a 25-document piped
  run (S15 shape) — all matched spec exactly (see session transcript; not committed as a test
  file since e2e-author's `compile-check.cli.test.mjs` already formalizes this layer).
- No lint/typecheck tooling exists in this repo (`AGENTS.md`: "仍无 lint / typecheck 脚本") —
  nothing to run.

## Oracle (this repo has no mutation-testing tool; hand-mutation used instead)

Two targeted hand-mutations of `src/cli/compile-check.mjs`, each reverted immediately after:

1. Forced `describeCompileFailure` to always return `{ reason }` (dropping the
   line/column branch) → `test/compile-check.test.mjs` failed exactly the 2 tests that assert
   a position (`describeCompileFailure: a VFileMessage with a position…`, `S2: …`), all others
   stayed green. Confirms the position-vs-no-position branch is actually exercised.
2. Removed the `onResult` invocation from `checkDocuments`'s loop → failed exactly the 2 F12
   contract tests that depend on `onResult` being called (the "exactly once" and the
   "throwing aborts" tests), all content-level tests (S1–S19) stayed green since they don't
   pass `onResult`. Confirms the F12 contract tests are not vacuously true.

Both mutations were caught by the suite and both were reverted before the final green run
recorded above (`diff /tmp/compile-check.mjs.bak src/cli/compile-check.mjs` → no diff).

## Coverage gate

`node --test --experimental-test-coverage` (Node's built-in coverage; no third-party tool, per
this repo's zero-test-dependency constraint):

```bash
node --test --experimental-test-coverage \
  --test-coverage-include='src/cli/output.mjs' --test-coverage-include='src/cli/compile-check.mjs' \
  test/compile-check.test.mjs test/cli-output.test.mjs test/mdx-pipeline.test.mjs
```

| File | Line % | Branch % | Funcs % |
|---|---|---|---|
| `src/cli/compile-check.mjs` | 100.00 | 91.30 | 100.00 |
| `src/cli/output.mjs` (whole file, incl. pre-existing preview/export formatters) | 99.00 | 94.87 | 100.00 |

- **Interface coverage: 100%.** Every exported symbol touched by this change —
  `describeCompileFailure`, `checkDocuments` (new); `resolveCheckColors`, `formatCheckPath`,
  `formatCheckLine`, `formatCheckSummary` (new); `formatHelp` (modified, its `--check` row and
  `Notes:` boundary paragraph explicitly asserted) — has at least one direct test call in
  `test/compile-check.test.mjs`.
- **Line coverage: 100% on the new module, 99% on the touched module** — both well above the
  90% gate. `output.mjs`'s two remaining uncovered lines (161-162, inside the pre-existing
  `formatParserMessage`) predate this change and are exercised by other test files not included
  in this coverage run (e.g. `cli-language.test.mjs`'s subprocess cases).

## Commit

Not yet committed — per this agent's instructions, commits are created by the calling
controller/user's own workflow unless explicitly asked. All changes are on disk, uncommitted,
on branch `dev` (working tree was clean at `15433c9` before this session).

---

## Increment — P2 cleanup from code review (`code-review/CHECKLIST.md` #A1, #B1)

Role: `developer`. Base for this increment: same uncommitted working tree, `git rev-parse
HEAD` still `15433c9`. Scope: `bin/mdxv.mjs`, `test/compile-check.test.mjs` only. Both P2s
were **HELD** findings (zero P0/P1 in either verdict) — this is cleanup, not a rework, and
does not reopen Verdict A or B.

### #A1 — `--check=<value>` bypassing the bare-argv probe

**Root cause**: `bin/mdxv.mjs`'s `checkMode` (used only to pick the exit code — 1 vs 2 — for
argument-level failures that occur *before* `cac` ever parses anything, e.g. a malformed
`--lang`) was computed as `process.argv.slice(2).includes("--check")` — an exact-token match.
`--check=true` never matches that token, so `checkMode` disagreed with what `cac` itself
would later compute for `opts.check`, and the argument failure exited 1 (documented as
"broken") instead of 2 ("called wrong") — the exact confusion D2 exists to eliminate.

**Investigated before fixing** (`node -e` probing `cac` directly, not from memory): for a
boolean option declared without a `<value>` placeholder (`.option("--check", …)`, exactly how
this repo declares it), `cac`'s own coercion is: `--check`, `--check=true`, `--check=xyz`,
`--check=` all become `true`; **only** the literal `--check=false` becomes `false`. Repeated
occurrences of the flag produce an array (always truthy) — an existing `cac` quirk, unrelated
to this fix, not exercised by any advertised usage and left alone.

**Decision — "accepted, value honored" (not "argument-level failure exiting 2")**: the fix
makes the bare-argv probe replicate `cac`'s own coercion rule exactly, rather than rejecting
non-bare spellings as a new kind of argument error. Reasoning:
- `cac` itself never errors on any spelling of `--check=<value>` — it always coerces to a
  boolean. Making the *pre-parse* probe stricter than what `cac` *will* compute a few lines
  later would just create a new flavor of the same disagreement #A1 is about (the probe
  saying "invalid" while `cac` proceeds happily into whichever mode it decided).
- The checklist's own manual repro already established `--check=false` enters preview mode
  correctly and needs no change ("语义自洽，无需改"). The reviewer's literally-suggested regex
  (`.some(a => a === "--check" || a.startsWith("--check="))`) would have swept `--check=false`
  into `checkMode === true` too, which would have **regressed** that already-correct case: an
  argument failure alongside `--check=false` would then wrongly exit 2 (check-mode accounting)
  for what is, by every other signal, a preview-mode invocation. Excluding the literal
  `--check=false` value from the probe (mirroring `cac`'s own one falsy spelling) avoids
  that regression — confirmed by test (see below).
- Contrast with `--lang`: `src/cli/language.mjs`'s `parseLanguageArgument` /
  `resolveCliLanguage` *do* reject malformed values, because a locale string carries semantic
  content that can be wrong. `--check` is a bare switch — spec/help have only ever advertised
  the bare form — so there is nothing about a value spelling to validate; there is only
  `cac`'s own coercion to agree with.

**Fix** (`bin/mdxv.mjs`, the `checkMode` line): replaced the exact-token `.includes` with
`.some((arg) => arg === "--check" || (arg.startsWith("--check=") && arg.slice("--check=".length) !== "false"))`,
with a comment recording the reasoning above so a future reader doesn't "simplify" it back to
the reviewer's naive regex and reintroduce the `--check=false` regression.

### #B1 — dead imports in `test/compile-check.test.mjs`

Confirmed before touching anything (`grep -n "mkdtempSync\|rmSync\|writeFileSync\|chmodSync"
test/compile-check.test.mjs`): `mkdtempSync`, `rmSync`, `writeFileSync` each appeared exactly
once — in the `import` line itself — while `chmodSync` appeared 3 times (import + 2 real
calls in the S9 test). The finding was accurate. Fix: import only `chmodSync`.

### Red → green (test-first, for #A1)

Wrote the 3 new tests, then ran them against the **unfixed** `checkMode` line (temporarily
restored via a local copy, not a commit) with `node --test --test-name-pattern="#A1"
test/compile-check.test.mjs`:

- `--check=true …` → **failed** (`1 !== 2`, i.e. reproduced the exact bug: exit 1 instead of
  2) — the red state, for the right reason.
- bare `--check …` (control) → passed (unaffected — proves the test isolates the `=true`
  spelling specifically, not a broader regression).
- `--check=false …` → passed (proves the fix's exclusion doesn't need to exist yet to pass
  this one — it's the *fix's* job to keep it passing once it changes the matching rule; see
  below).

Restored the fix, re-ran the same 3 tests → all green. This confirms the tests fail for the
right reason pre-fix and pass post-fix, including the regression guard for `--check=false`
that the naive suggested fix would have broken (verified by literally trying the naive regex
first, observing it would flip the `--check=false` test red, then adopting the coercion-aware
version instead — see the `#A1` reasoning above for why).

### Why these tests are subprocess-level, in a file whose header says "no subprocess"

The bug is in a **bare-argv probe** inside `bin/mdxv.mjs` itself — by construction, it cannot
be reproduced as a direct function call the way the rest of this file's tests are, and
`compile-check.mjs`'s public surface is explicitly closed at exactly two exports (`design.md`:
"公开面就这两个，没有第三个" — `describeCompileFailure`, `checkDocuments`); adding a third
export to make the probe unit-testable would violate that design constraint for a P2 fix that
doesn't need to. `test/compile-check.cli.test.mjs` (e2e-author's, not touched) is the natural
architectural home for subprocess-level `--check` scenarios, but this task was explicitly
scoped to land the regression test in this file. The file's header comment was updated to
record this one deliberate exception.

### Final test-run results (this increment)

- `node --test test/compile-check.test.mjs` → **28/28 pass** (25 pre-existing + 3 new).
- `npm run test:unit` (`make test-unit`) → **112/112 pass**, exit 0, ~24s wall (was 109/109
  before this increment; +3 matches the 3 new tests, all newly added to this same file which
  was already in the `test:unit` list — no file-list changes needed).
- `npm test` (`make test`) → **121/121 pass**, exit 0, ~26s wall (was 118/118 before this
  increment; +3, same reason as above — no other file's test count moved).
- No lint/typecheck tooling exists in this repo (confirmed again: `grep -n
  "\"lint\"\|\"format\"" package.json Makefile` → no hits; `AGENTS.md:135` self-states this) —
  nothing to run.
- Commit: still uncommitted; `git rev-parse HEAD` → `15433c9` (unchanged). Diff scope for this
  increment: `bin/mdxv.mjs`, `test/compile-check.test.mjs` only (`git status --porcelain`
  confirms no other file touched by this increment).

### Oracle

Both fixes are narrow enough that the existing hand-mutation discipline from the original
implementation still applies without a new mutation pass: #A1 is directly proven by a
red→green cycle against the real bug (above), not a simulated mutation. #B1 is a dead-code
removal with no behavior to mutate; its correctness is proven by "the suite still passes with
the unused names gone" (it does — see above) plus the `grep` confirmation that nothing else
referenced them.

### Scope discipline

Not touched, per file ownership for this dispatch: `test/compile-check.cli.test.mjs`,
`test/compile-check.perf.test.mjs`, `test/fixtures/compile-check-e2e/`, `e2e-manifest.md`, and
every spec artefact under `openspec/changes/mdx-compile-check/` (`specs/compile-check/spec.md`,
`design.md`, `REVIEW.mdx`, `tasks.md`, `arch-review.md`, `CHECKLIST.md`, `PIPELINE.md`).
#A2 (design.md stale sentence), #A3 (boundary-wording), #A4 (docs-sync), #A5 (design.md test
file names) were not addressed — explicitly out of scope for this dispatch, routed elsewhere
per the checklist's own "Tracked" table.

---

## Increment 2 — #A3 boundary-wording rewrite (planner-revised, user-approved, `tasks.md` 2.6)

Follow-up dispatched by the controller after Increment 1 was independently verified. `planner`
revised the `--check` tier-B boundary wording from a closed two-item enumeration to
mechanism-plus-examples (per `tasks.md` 2.6) because a closed list licenses "no import, no
`{…}`, therefore safe to ship" — the exact false inference R6 exists to prevent. Only
`cli.checkBoundaryNote` changes; `formatHelp`'s three-section structure and preamble were left
untouched (confirmed: `output.mjs:46` only interpolates the message key, no structural edit
needed).

**Applied verbatim**, both locales, `src/i18n/messages.mjs`'s `cli.checkBoundaryNote`:
- `zh-CN`: "--check 只校验编译，不保证文档能加载：任何顶层 ESM 语句或 `{…}` 表达式在模块求值 /
  渲染期失败，都会让文档加载不出来而不被本命令发现 —— 例如模块无法解析、标识符未定义、或初始化器
  自身抛错。这些只是例子，不是清单（围栏代码块里的 import 不受影响，写文档讲 JavaScript 完全正常）。"
- `en-US`: "--check verifies compilation only, not that a document can load: any top-level ESM
  statement or `{...}` expression that fails at module evaluation or render time will keep the
  document from loading yet go undetected here — for example an unresolvable module, an
  undefined identifier, or an initializer that itself throws. These are examples, not an
  exhaustive list (import inside a fenced code block is unaffected — documenting JavaScript
  works fine)."

**Test update** (`test/compile-check.test.mjs`, the "S10 (help clause)" test): replaced the
literal-`` `import` `` assertion with three assertions matching the three load-bearing pieces
the controller flagged as non-negotiable: (1) `/top-level ESM statement/` — the mechanism,
worded as a statement class rather than the bare `import` keyword — plus a `doesNotMatch`
guard that the boundary text no longer narrows down to a literal backtick-`` `import` ``;
(2) `/examples, not an exhaustive list/i` — the explicit non-exhaustiveness marker, the whole
point of the rewrite; (3) `/fenced code block/` — the existing fenced-code exemption note,
unchanged. `test/compile-check.cli.test.mjs` was **not** touched — a parallel `e2e-author`
dispatch owns its help assertion and a new scenario there.

**Test-run results**: `node --test test/compile-check.test.mjs` → **28/28 pass** (no count
change — this was an assertion-content update, not a new test). `npm test` → **121/121 pass**,
exit 0 (unchanged from Increment 1 — this increment added no test, removed none).

---

## Increment 3 — #B6: the #A3 help-text assertion covered en-US only, not zh-CN

Follow-up from the controller, after the delta review confirmed both verdicts HELD and
independently reproduced `npm test` at 122/122. Finding #B6 (P3): Increment 2's "S10 (help
clause)" test only pinned the English `cli.checkBoundaryNote` wording. The pre-existing locale
tests (`test/cli-*` suites) only assert that message *keys* exist across both catalogs, never
their prose — so the zh-CN note (this project's primary-audience wording, per `AGENTS.md`)
could silently drift back to a closed two-item enumeration, exactly the defect #A3 fixed,
without any test turning red. Fixed by mirroring the same four load-bearing markers in a
dedicated zh-CN test, asserting on markers rather than full-string equality (same discipline as
the English test):

1. compilation-only boundary claim — `/只校验编译，不保证文档能加载/`
2. mechanism wording — `/顶层 ESM 语句/`, plus `assert.doesNotMatch(help, /\`import\`/)` mirroring
   the English negative guard (the boundary itself must not be narrowed back to the bare
   backtick-`import` form)
3. non-exhaustiveness marker — `/这些只是例子，不是清单/` (the core of the #A3 rewrite)
4. fenced-code exemption — `/围栏代码块里的 import 不受影响/`

**Red→green proof, exactly as requested** (temporary, restored byte-for-byte afterward):

1. Ran the new zh-CN test against the *current* (post-#A3) wording → **green**
   (`node --test --test-name-pattern="zh-CN" test/compile-check.test.mjs` → 1/1 pass).
2. Backed up `src/i18n/messages.mjs` to `/tmp/messages.mjs.fixed`, then replaced only the
   `zh-CN` `cli.checkBoundaryNote` value with the pre-#A3 closed-set wording ("--check 只校验编译，
   不保证文档能加载：顶层 ESM `import`/`export ... from` 语句的模块无法解析、`{…}` 表达式里的
   未定义标识符，都会让文档加载失败但不会被本命令发现（围栏代码块里的 import 不受影响，写文档讲
   JavaScript 完全正常）。") — the `en-US` entry was left untouched throughout.
3. Re-ran the same test → **red**, on the first discriminating assertion:
   `AssertionError: 机制措辞必须是「顶层 ESM 语句」，而不是把边界收窄成裸 import` (`expected:
   /顶层 ESM 语句/` against the actual reverted help text, which still says
   `` 顶层 ESM `import`/`export ... from` 语句 `` — not the contiguous phrase).
4. Because `assert.match` throws on the first failing line, the other two discriminating
   assertions were verified independently against the same reverted wording via a one-off
   `node -e` probe of `formatHelp` (not a permanent test change): `` /`import`/ `` **matches**
   the reverted text (so the `doesNotMatch` guard would fail too — red, correct) and
   `/这些只是例子，不是清单/` **does not match** (red, correct). The two non-discriminating
   markers — compilation-only claim and the fenced-code exemption, both pre-existing invariants
   unrelated to #A3 — correctly stayed **true** against the reverted wording too, confirming
   they aren't accidentally doing the discriminating work.
5. Restored `src/i18n/messages.mjs` from the backup (`diff /tmp/messages.mjs.fixed
   src/i18n/messages.mjs` → no diff, confirmed byte-identical) and re-ran the zh-CN test →
   **green** again.

This confirms the assertion set only passes against the good wording and reliably fails
against the bad one — not a vacuous check that would pass either way.

**Scope discipline**: only `test/compile-check.test.mjs` was permanently changed;
`src/i18n/messages.mjs` was touched only transiently for the red proof and is byte-identical
to its Increment-2 state afterward (confirmed above). `test/compile-check.cli.test.mjs` and
`test/fixtures/compile-check-e2e/` were not touched — `e2e-author`'s parallel P3. #B5
(`--` has no established `mdxv` semantics; exit 2 vs 1 on that path) and #A5 (stale file list
in `design.md`) were left alone per the controller's explicit instruction not to pre-empt them.

**Final test-run results**: `node --test test/compile-check.test.mjs` → **29/29 pass** (28 +
1 new zh-CN test). `npm test` → **123/123 pass**, exit 0 (122 + 1, matching the controller's
independently-confirmed 122/122 baseline plus this increment's one new test).
