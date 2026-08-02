# compile-check Specification

## Purpose
TBD - created by archiving change mdx-compile-check. Update Purpose after archive.
## Requirements
### Requirement: Compile parity and per-document format derivation

`mdxv --check <file|dir|demo>` SHALL compile every resolved document through this project's own
`mdxOptions()` plugin set (`src/mdx/plugins.mjs`) and SHALL derive each document's `format` from its
file extension exactly as `@mdx-js/rollup` does — `.mdx` compiled as MDX, `.md` compiled as markdown
without the MDX JSX extension — so the check never reports a failure the preview and export paths
would not have. The check MUST NOT force one format onto every document. Two compile inputs are
deliberately NOT aligned because neither can change a pass/fail verdict: `SourceMapGenerator`
(diagnostics only) and `development` (which the two existing paths already disagree on — `mdxv` runs
Vite in development mode, `mdxx` in build mode). Each document SHALL be compiled independently so one
failure never suppresses the remaining reports.

The guarantee the check offers SHALL be stated in exactly this asymmetric form, because only one
direction is sound:

- a document the check **fails** definitely cannot be rendered by the preview or export paths;
- a document the check **passes** has no markdown/MDX compile error under this project's plugin set —
  its syntax parses, its frontmatter is valid YAML, and its `dot`/`graphviz` fences really do render
  through graphviz-wasm at compile time — but passing does NOT mean the document will load, because
  module specifiers are resolved by Vite after compilation and `{…}` expressions are evaluated at
  render time.

#### Scenario: S1 Single passing file

- **WHEN** `mdxv --check <file.mdx>` is run on a document that compiles
- **THEN** it exits 0, prints exactly `✓ <path>` on stdout, prints nothing on stderr, and prints no
  summary line

#### Scenario: S2 Single failing file reports the exact position

- **WHEN** `mdxv --check <file.mdx>` is run on a document whose hard-wrapped inline code span puts a
  continuation line starting with `<` at the beginning of a line (for example a line beginning
  `<global|tenant|workspace>`)
- **THEN** it exits 1 and prints on stdout `✗ <path>:<line>:<column>` followed by two spaces and a
  reason beginning `` Unexpected character `|` (U+007C) in name ``, where `<line>` and `<column>` are
  the 1-based position of the offending character in that document

#### Scenario: S5 Full-feature document keeps parity with the real pipeline

- **WHEN** `mdxv --check` is run on a document exercising frontmatter, GFM, `$…$` math, a `dot`
  fence, a `mermaid` fence, and a highlighted code fence — all of which the preview and export paths
  accept
- **THEN** it exits 0 and reports the document as passing, and the plugin set used is the one returned
  by `mdxOptions()` rather than bare MDX defaults

#### Scenario: S13 Format follows the extension in both directions

- **WHEN** one byte-identical document containing a line that begins `<global|tenant|workspace>` is
  checked twice, once named `<name>.md` and once named `<name>.mdx`
- **THEN** the `.md` run exits 0 reporting it as passing, because markdown treats that line as text
  and the preview renders it, while the `.mdx` run exits 1 reporting the JSX-name failure

### Requirement: Document-set resolution

Check mode SHALL resolve its document set from one positional input — a file becomes exactly that
one document, a directory becomes every `.md`/`.mdx` file found by `scanTree` recursively, and `demo`
becomes **every** document in the packaged demo directory. It SHALL report the documents in `scanTree`
order and SHALL NOT select a single default document; in particular the `demo` input SHALL ignore the
`target` that the existing preview wiring pairs with it, since that `target` is shaped identically to a
single-file input and would otherwise silently reduce the demo set to its first document.

#### Scenario: S3 Directory with mixed results

- **WHEN** `mdxv --check <dir>` is run on a directory holding both compiling and non-compiling
  documents
- **THEN** it exits 1 and prints on stdout one `✓`/`✗` line per document in path-sorted order,
  followed by a summary line `<N> passed, <M> failed`

#### Scenario: S4 Directory with every document passing

- **WHEN** `mdxv --check <dir>` is run and every resolved document compiles
- **THEN** it exits 0 and prints one `✓` line per document plus a summary line whose failed count is 0

#### Scenario: S16 Demo input covers the whole packaged demo

- **WHEN** `mdxv --check demo` is run
- **THEN** it exits 0 and reports **exactly two** documents, naming both `demo/index.mdx` and
  `demo/index.zh-CN.mdx`, so the localized variant is never silently skipped

### Requirement: Report format degrades without inventing positions

The check report SHALL omit the `:line:column` segment when the compile failure carries no position,
printing `✗ <path>` followed by two spaces and the reason, and SHALL never fabricate or borrow a
position from unrelated text. Every path SHALL print relative to the current working directory unless
the relative form would escape upward, in which case the absolute path is printed; paths and reasons
SHALL stay raw and uncoloured so they remain copyable.

#### Scenario: S8 Failure without position information

- **WHEN** a checked document contains a `dot` fence whose graph source is syntactically invalid, so
  the compile failure is a plain error with no line or column
- **THEN** it exits 1 and prints `✗ <path>` followed by two spaces and the reason, with no
  `:line:column` segment and no stack trace, and the reason's own wording (which may mention a line
  number of the graph source) is never reinterpreted as a position in the document

#### Scenario: S9 Unreadable document inside a directory counts as failed

- **WHEN** a document inside a checked directory exists and matches `.md`/`.mdx` but cannot be read
- **THEN** it exits 1, prints a `✗` line for that document carrying the operating-system reason and
  no position, counts it in the failed total, and still reports every other document

### Requirement: Exit-code and stream contract

Check mode SHALL exit 0 when the document set is non-empty and every document compiled, 1 when at
least one document failed, and 2 when the check could not be performed at all. Exit 2 SHALL cover every
argument-level failure while `--check` is present — including an invalid, valueless, or repeated
`--lang`, which the existing argument boundary resolves before any `--check` awareness and would
otherwise report as exit 1 — plus a missing, unreadable, or non-MDX input path and an empty document
set. A directly addressed unreadable file SHALL therefore exit 2, while an unreadable file found inside
a scanned directory exits 1; this asymmetry is deliberate, because for a single-file input no document
was checked at all.

Engine and asset failures SHALL NOT be routed to a separate exit code, because per-document compilation
is the only place they can occur: the compile call builds its own processor per document, graphviz-wasm
is awaited inside the diagram transformer, and the syntax highlighter is created inside the
highlighting transformer. Such a failure is therefore reported as that document's `✗` line and counted
toward exit 1, with the reason text as the only discriminator — the same convention the unreadable-file
case already uses. A wholly unusable installation (a broken plugin package) throws while the check
module is being imported, which surfaces as the CLI's pre-existing startup failure; this change does
not redefine that behaviour. No requirement here SHALL be satisfiable only by substituting the compile
function, and no such substitution seam is to be built.

Check mode SHALL write the per-document lines and the summary line to stdout, and every `Error:`
diagnostic to stderr. It SHALL set `process.exitCode` and return normally rather than calling
`process.exit()`, so that a piped stdout is flushed completely. The summary line SHALL be printed only
when the document set holds more than one document, so consumers MUST determine the outcome from the
exit code rather than from the presence of the summary.

#### Scenario: S6 Usage and input errors are distinguishable from broken documents

- **WHEN** `--check` is given no path, a nonexistent path, a directly addressed file that cannot be
  read, a path that is neither a directory nor a `.md`/`.mdx` file, a directory holding no documents,
  an unknown option, or a `--lang` that is invalid, missing its value, or repeated
- **THEN** it exits 2, prints one localized `Error:` diagnostic to stderr with no stack (followed by
  complete help for the argument-level failures), and prints nothing to stdout

#### Scenario: S15 Piped report is never truncated

- **WHEN** a directory of at least 20 documents is checked with stdout connected to a pipe
- **THEN** the consumer receives exactly one line per document plus the summary line, with no line
  lost to process exit

### Requirement: Check mode performs no side effects

Check mode SHALL start no server, bind no port, open no browser, write no file, and evaluate no code
from the checked documents; it SHALL terminate on its own. `--lang` SHALL apply, while `--port`,
`--host`, and `--no-open` SHALL be accepted and ignored rather than rejected, and `--help`/`--version`
SHALL keep precedence over `--check`.

#### Scenario: S7 Server options are inert under --check

- **WHEN** `mdxv --check <file.mdx> --port <n> --host --no-open` is run
- **THEN** the process exits without listening on `<n>`, without opening a browser, and without
  creating any file, and its report is identical to the same invocation without those three options

### Requirement: Documented boundary in two severity tiers

The check SHALL document its non-detections in two tiers, because they differ in consequence, and the
`mdxv` help text SHALL name the second tier explicitly — that is the tier which breaks the
"passed, therefore deliverable" reading the cross-repo consumer depends on.

- **Tier A — the document loads but is wrong:** an undefined component (a clear error at render time),
  an invalid component prop value (silently ignored), and malformed math (KaTeX renders an error node).
- **Tier B — the document does not load or render at all:** any **top-level ESM statement** or `{…}`
  expression that fails at module evaluation or render time — for example an unresolvable specifier,
  an undefined identifier, or an initializer that itself throws.

Tier B SHALL be stated as that **mechanism** with its items given as examples, never as a closed
enumeration. A closed list invites the inference "my document has no `import` and no `{…}` expression,
therefore passing means deliverable" — and defeating exactly that inference is why this requirement
exists. The mechanism is open-ended by nature: every tier-B shape is invisible at compile time by
construction, so no enumeration can be complete.

Tier B SHALL be worded as a *top-level ESM statement* and never as a bare mention of "import",
because an `import` line inside a fenced code block is inert text that compiles and loads fine —
documents that *document* JavaScript are a primary use case and MUST NOT be implicated.

Tier B members SHALL NOT be assumed to be catchable by the export command either. Only the
build-time subset is: an unresolvable specifier fails `mdxx` because Vite resolves specifiers during
the build, whereas an initializer that throws and a throwing `{…}` expression both leave `mdxx`
exiting 0 while producing an HTML file that fails when opened. Any paired assertion against `mdxx`
therefore SHALL be confined to the build-time subset.

#### Scenario: S10 Undefined component is not detected

- **WHEN** `mdxv --check` is run on a document containing `<Foo bar="x" />` where `Foo` is not a
  provided component
- **THEN** it exits 0 reporting the document as passing, and `mdxv --help` contains a note stating that
  `--check` verifies compilation only

#### Scenario: S18 Invalid prop value is not detected

- **WHEN** `mdxv --check` is run on a document containing `<Callout tone="nope">` with a prop value
  outside the component's supported set
- **THEN** it exits 0 reporting the document as passing

#### Scenario: S19 Malformed math is not detected

- **WHEN** `mdxv --check` is run on a document containing malformed math such as `$\frac{1}{$`
- **THEN** it exits 0 reporting the document as passing

#### Scenario: S14 Unresolvable top-level import passes the check but fails the real pipeline

- **WHEN** one document containing `import Thing from "./does-not-exist.js"` plus `<Thing />` is both
  checked and exported, and a second document carrying those same `import` lines only inside a fenced
  `js` code block is exported
- **THEN** `mdxv --check` exits 0 on the first document while `mdxx` on the same document exits 1 —
  pinning this non-detection as deliberate and regression-protected for the build-time subset of
  tier B — and `mdxx` exits 0 on the second document, proving fenced code is never treated as an ESM
  statement

#### Scenario: S20 Evaluation-time tier-B shapes escape both commands

- **WHEN** a document whose top-level `export` initializer throws, and a document containing a `{…}`
  expression that throws when evaluated, are each both checked and exported
- **THEN** `mdxv --check` exits 0 and `mdxx` also exits 0 on both — establishing that for this subset
  no command-line gate is a witness at all, and that the only witness is loading the document; if a
  later change makes either command detect these, this scenario flips and forces the boundary wording
  to be updated

### Requirement: Localized presentation with per-stream colour

The check report SHALL take its localized wording from the product message catalogue via `t()`, and
SHALL decide ANSI colouring **separately for each stream it actually writes** — the report and summary
lines by stdout's TTY state, the `Error:` diagnostic by stderr's — rather than from a single
process-wide decision. This is required because the report moved to stdout while the existing CLI
derives colour from `process.stderr.isTTY`: in the advertised consumer invocation
(`mdxv --check <dir> >report 2>err`) stderr is still a terminal, so a process-wide decision would write
ANSI escapes into the captured report and force the consumer to carry a strip-regex as part of the
contract. Colour SHALL apply only to the `✓`/`✗` marks. Compiler reason text originates upstream and
SHALL NOT be translated or rewritten.

#### Scenario: S11 Colour follows the written stream, and wording follows the locale

- **WHEN** the colour decision is resolved for a non-TTY stdout paired with a TTY stderr — the shape of
  the advertised `>report 2>err` invocation — and the same mixed directory is checked with
  `--lang zh-CN` and with `--lang en-US`
- **THEN** the report carries no ANSI sequence while the diagnostic may carry one, and both locales
  produce identical marks, paths, positions and reasons while the summary line and any `Error:`
  diagnostic appear in the selected language

### Requirement: Check performance budget

The check SHALL be materially cheaper than the `mdxx` export workaround it replaces, performing one
compile per document with no Vite build. The **asserted** criterion SHALL be that structural fact
itself — the check SHALL complete without ever entering Vite, calling neither `build` nor
`createServer` — rather than any measurement of elapsed time. Wall-clock figures are recorded as a
budget for the performance gate and are never asserted in the test suite: a wall-clock ratio is
satisfiable by slowing the export down, is insensitive to a check that merely doubles in cost, and
false-fails under CPU contention because it compares a startup-dominated process against a
throughput-bound one. Because the structural criterion runs no build, the scenario SHALL live in the
fast unit lane.

#### Scenario: S12 Check does not enter the build path

- **WHEN** `mdxv --check examples/demo.mdx` runs with Vite's `build` and `createServer` instrumented
- **THEN** the check exits 0 having called neither of them, while the same instrumentation applied to
  the same binary in preview mode is observed calling `createServer` — so a probe that has stopped
  detecting anything fails the scenario instead of passing it vacuously

