# TDD evidence — diagram-theme-adaptation

Root cause and semantic decisions: see `HYPOTHESIS.md` (controller-diagnosed, empirically
evidenced). This file records the red→green transcript, the scenario→test mapping, the
final test-run result, and the layering rationale for the fix itself.

## Layering decision (accepted HYPOTHESIS.md's direction, judged on its merits)

Moved theming from string-regex on the raw SVG text to a pass over the parsed hast tree,
which both lanes (`dot`, `svg`) already produce via `svgToHast`. Concretely, in
`src/mdx/diagrams.mjs`:

- `themeSvg` (string level) now does **only** color-unrelated structural cleanup: strip the
  XML prologue/DOCTYPE, add the responsive `style="max-width:100%;height:auto"`. No color
  regex left in it.
- `themeColors(nodes)` (new, hast level) walks every element and classifies `fill`/`stroke`
  — read from either the presentation attribute or a `style="…"` declaration, whichever is
  present, normalized (whitespace-stripped, lower-cased) — against the black/white spelling
  sets. Matches get a semantic class (`mv-diagram-fg-fill` / `-fg-stroke` / `-bg-fill` /
  `-bg-stroke`); everything else (author colors, `"none"`, already-semantic values) is left
  untouched. The one extra rule: a `<text>` element with **no** `fill` at all also gets
  `mv-diagram-fg-fill` — this is the actual bug (SVG's initial `fill` value is black, not
  `currentColor`, and Graphviz never writes `fill` on `<text>`).
- `stripGraphvizBackdrop(nodes)` (new, hast level) replaces the old id-anchored string regex
  that removed Graphviz's white full-canvas backdrop polygon inside `<g id="graph0"
  class="graph">`. Same anchor (id + class), now matched structurally instead of by regex,
  and classifying the polygon's fill through the same black/white spelling logic instead of
  two literal spellings.
- Real colors live in `src/app/styles/theme.css` (`.mv-diagram-fg-fill` →
  `fill: currentColor !important`, `.mv-diagram-bg-fill` → `fill: var(--surface)
  !important`, and the `stroke` equivalents). `!important` is there deliberately: it is the
  one thing that reliably beats an inline `style="fill:…"` attribute regardless of which of
  the two paths (presentation attribute vs. inline style) supplied the original color — a
  plain class selector already beats a presentation attribute unconditionally, but not an
  inline `style`, and the two paths are indistinguishable to callers of `themeColors`.
  Classes only apply to elements this plugin explicitly marks, so the blast radius is
  exactly the theming this bug is about, nothing page-wide.
- Rejected: `fill="var(--surface)"` as a presentation attribute (flagged as unreliable
  across browsers in HYPOTHESIS.md — presentation attributes accept a raw color value, not
  general CSS syntax with functions, so `var()` support there is implementation-lenience,
  not spec-guaranteed). `currentColor` as a **presentation attribute** is fine and is what
  the old code already relied on for the foreground case — kept that path for `fill`/no-op
  attribute mutation; new code instead adds a class uniformly for both foreground and
  background so one mechanism covers both cases and both source paths (attribute vs.
  style).

## Decision: which behavior wins on the Graphviz backdrop polygon

HYPOTHESIS.md's hard boundary asked this to be decided deliberately: the backdrop
`<polygon fill="white">` inside `<g id="graph0" class="graph">` exists so `dot` diagrams
are transparent like the `svg`/`mermaid` lanes. The new white→background semantic rule
would, if applied generically, turn that polygon into an opaque `var(--surface)` rectangle
instead. **The structural strip wins** — `stripGraphvizBackdrop` runs and removes the node
entirely, so it never reaches the generic classifier. Reasoning: turning it into an opaque
backing is a new, unrequested behavior change (dot diagrams would stop being transparent,
diverging from the other two lanes) — out of scope for a bug fix about text/stroke
visibility. Covered by
`"dot 车道：graph0 背景多边形仍被剥掉（保持与 svg/mermaid 车道一致的透明画布）"` in
`test/diagram-theme.test.mjs`.

## Scenario → test mapping

| # | Scenario | Test(s) in `test/diagram-theme.test.mjs` |
|---|---|---|
| S1 | Core regression: Graphviz's `<text>` (no `fill`) must get foreground, not SVG's black default | `dot 车道核心回归：Graphviz 不写 fill 的 <text> 必须拿到前景语义色…` |
| S2 | `dot` lane stroke also themed (existing behavior preserved through the refactor) | `dot 车道：节点描边 stroke="black" 换成前景语义色` |
| S3 | Graphviz backdrop polygon still stripped (transparency parity across lanes), not repainted opaque by the new white rule | `dot 车道：graph0 背景多边形仍被剥掉…` |
| S4 | Black spelling matrix (`black`, `#000`, `#000000`, `rgb(0,0,0)`, case/space variants) on `fill` and on `stroke`, via presentation attribute | 12 generated tests, `svg 车道拼写矩阵 · fill/stroke="…" 应换成前景语义色` |
| S5 | Black inside `style="…"` (attribute-only regex could never see this) | `svg 车道 · style="fill:black" 变体…`, `svg 车道 · style="stroke: BLACK" 变体…` |
| S6 | White spelling matrix (`white`, `#fff`, `#ffffff`, `rgb(255,255,255)`) on `fill`, via presentation attribute | 4 generated tests, `svg 车道拼写矩阵 · fill="…" 应换成背景语义色` |
| S7 | White inside `style="…"` | `svg 车道 · style="fill:white" 变体应换成背景语义色` |
| S8 | Author-chosen explicit color (`fill="red"`) must survive untouched — the hard boundary | `svg 车道 · fill="red" 是作者的表达意图，不应被当成语义色改写` |
| S9 | `fill="none"` is neither "unspecified" nor black/white — must not be touched; `stroke` on the same element still themed normally | `svg 车道 · fill="none" 不是「未指定」，也不是黑/白，不应被语义化…` |
| S10 | "Unspecified fill → foreground" is scoped to text-painting elements only, not every shape | `svg 车道 · 未写 fill 的非文字元素（如 rect）不应被当成语义色…` |
| S11 | Hand-authored `svg` lane (not just Graphviz output) also gets the unspecified-`<text>`-fill fix — both lanes share one function | `svg 车道 · 未写 fill 的 <text> 元素必须被当成黑色（前景）…` |

Pre-existing test updated: `test/mdx-pipeline.test.mjs` — `图 · dot 车道：构建期出内联 SVG，
黑色描边换 currentColor` asserted the literal string `"currentColor"` in the compiled JS,
which no longer appears there (colors now live only in `theme.css`, not in the compiled
MDX output). Renamed and re-pointed at the new marker (`mv-diagram-fg-stroke` class in the
compiled output) — the compiled-JS layer only proves the *class* landed; the fine-grained
matrix and the correctness of the class-to-color mapping live in the new dedicated file.

## Red → green transcript

**Red** (verified by `git stash push -- src/mdx/diagrams.mjs src/app/styles/theme.css
test/mdx-pipeline.test.mjs`, reverting to the old string-regex `themeSvg` with no
`themeColors`/`stripGraphvizBackdrop`, running the already-final 26-test file against it,
then `git stash pop` to restore the fix):

```
$ node --test test/diagram-theme.test.mjs
Exit: 1
ℹ tests 26   (10 static + 16 generated from the spelling-matrix loops)
ℹ pass 3     # only the trivially-true-under-a-no-op cases: author-color-preserved,
             # non-text-unspecified-fill-untouched, and the pre-existing graph0 strip
ℹ fail 23
```

**Green** (after the product-code change in `src/mdx/diagrams.mjs` +
`src/app/styles/theme.css`):

```
$ node --test test/diagram-theme.test.mjs
Exit: 0
ℹ tests 26
ℹ pass 26
ℹ fail 0
ℹ duration_ms 105.578375
```

**Pre-existing suite, updated assertion, confirmed red then green:**

```
$ node --test test/mdx-pipeline.test.mjs        (before update to the test)
✖ 图 · dot 车道：构建期出内联 SVG，黑色描边换 currentColor
  AssertionError: 描边/填充应替换为 currentColor
Exit: 1

$ node --test test/mdx-pipeline.test.mjs        (after updating the assertion)
Exit: 0, all 8 tests pass
```

**Full suite** (`npm test`, i.e. `node --test test/*.test.mjs` — unit + integration +
export smoke, excludes Playwright e2e which is a separate command):

```
$ npm test
Exit: 0
ℹ tests 149
ℹ pass 149
ℹ fail 0
ℹ duration_ms 26871.170917
```

Was 123/123 before this change. New total 149 = 123 + 26 (the new `diagram-theme.test.mjs`
file); no other file's test count changed (the `mdx-pipeline.test.mjs` edit changed an
assertion inside an existing test, not the count), and no regressions elsewhere.

```
$ npm run test:unit
Exit: 0
ℹ tests 140
ℹ pass 140
ℹ fail 0
```
(`test:unit` excludes `test/export.test.mjs` and `test/compile-check.perf.test.mjs`, which
is why 140 ≠ 149; both were included in the `npm test` run above and passed.)

Commit these test runs were stamped at: `ce99eabe80fbbe2ee0bebe125196bf2371107ab3` (repo
`HEAD`; changes below are uncommitted in the working tree per this repo's CLAUDE.md —
"不自动 commit / push" — no commit was made without an explicit request).

## Oracle

Toolchain is plain `node --test` (no built-in mutation runner in this repo, no existing
property-based-testing library). Followed the portable form instead: the black/white
spelling sets were exercised as an explicit enumerated matrix (6 black spellings × 2
properties, 4 white spellings, both attribute and `style=` sources) rather than a single
example per case, which is the property-based-testing spirit without pulling in a new
dependency in an unattended bug-fix track. Manually confirmed each new assertion actually
exercises product code (not a tautology) by running the full file against the pre-fix
code and observing genuine `AssertionError`s (not import/syntax errors) for every
color-classification test — see the red transcript above.

## Lint / format

No lint or format tooling exists in this project: no `eslint`/`prettier`/`biome` config at
the repo root, no `lint`/`format`/`fmt` script in `package.json`, and the `Makefile` (help
text checked) exposes only `install / link / demo / view / export / check-mdx / test* /
publish* / clean` — no lint/fmt target. Nothing to run or fix here.

## Manual verification already done by this dispatch (not a substitute for the mandatory
## browser-verify node — see "What's next" below)

Ran `node bin/mdxx.mjs examples/demo.mdx /tmp/demo-export.html` (the `mdxx` export path,
not just `mdxv`) against `examples/demo.mdx`, which contains real `dot` diagrams with
Chinese-labeled nodes, and inspected the emitted JS:

- The previously-invisible label `<text>` nodes now carry `className:"mv-diagram-fg-fill"`.
- `stroke="black"` node/edge outlines carry `className:"mv-diagram-fg-stroke"`.
- The arrowhead polygon (`fill:"black" stroke:"black"`) carries both classes.
- `.mv-diagram-fg-fill{fill:currentColor!important}` and
  `.mv-diagram-bg-fill{fill:var(--surface)!important}` are present in the inlined
  `<style>` in the exported HTML.
- No external `<script src=…>` / `<link href=…>` to any CDN; the only `http://`/`https://`
  strings in the file are inert content (SVG/XHTML `xmlns` URIs, author-written links in
  the demo doc text, and a `data:` URI favicon).

This confirms the class/CSS mechanism is wired correctly end-to-end in both `mdxv` and
`mdxx`, and that self-containment held. It does **not** prove a human can see the text —
that requires an actual browser render in both themes, which this dispatch does not do
(see below).

---

## Round 2 — code-review fixes (`CHECKLIST.md`)

Code review returned Verdict B (code-quality) HELD, Verdict A (spec-compliance) NOT HELD
on one P1 (`#A1`). The controller verified the P1 directly, decided the open semantic
question the reviewer parked (`OQ-1`), and asked for four fixes: `#A1` (P1, blocking),
`#B2`, `#B6`, `#B1` (all P2). `#B3` (a bigger enumerate-vs-parse-RGBA change) and the
`<text>`-only default (the reviewer confirmed the boundary is right, `tspan` must NOT get
the same treatment) were explicitly out of scope — not pre-empted. `#B4` (scope the
selectors under `.mv-diagram`), `#B5` (point the `mdx-pipeline` integration assertion at
`fill` instead of `stroke`), and `#B7` (merge the two synthetic-root tree walks) were not
in the controller's four-item list either — left untouched, same scope discipline.

### #A1 (P1) — inherited and internal-`<style>` colours were getting clobbered

**The bug.** `fill`/`stroke` are inherited SVG properties, and the classifier only read
each element's *own* attribute/style. An element with no own `fill` was treated as "the
SVG initial value applies" even when an ancestor (including the `<svg>` root itself) or an
internal `<style>` block was actually supplying its color. Reviewer's repro (all `svg`
lane; `dot` lane unaffected — real Graphviz output never omits `fill` on a shape and never
uses inheritance for it):

```
<g fill="#3b82f6"><text>hi</text></g>                              → text should stay blue, was clobbered to --ink
<svg fill="red"><text>hi</text></svg>                              → text should stay red, was clobbered
<g style="fill:var(--accent)"><text>hi</text></g>                  → should stay accent, was clobbered
<svg><style>.brand{fill:#f59e0b}</style><rect class="brand" fill="black"/></svg>
                                                                    → cascade should resolve to amber, was clobbered
```

This was a **regression against the pre-fix behavior**: the old code wrote
`fill="currentColor"` as a presentation attribute (priority 0), which an author's `<style>`
rule could still beat; the round-1 fix's blanket `!important` removed that escape hatch
entirely.

**Controller's decision (`OQ-1`, accepted as-is, judged on the merits — no changes made to
the endorsed shape):** inheritance and internal-`<style>` colouring both count as
author-chosen (`<g fill="…">` around text is a standard SVG idiom). Fix has two
independent halves, both required:

1. **Ancestor-aware walk** (`src/mdx/diagrams.mjs`, `themeColors`) — switched from
   `unist-util-visit` to `unist-util-visit-parents` (added as an explicit dependency in
   `package.json`; it was already an installed transitive dependency of
   `unist-util-visit`, confirmed via `node_modules` before adding it, so no new install
   surface). New helper `ownColor(node, prop)` returns the element's *own* colour (style
   value takes priority over the attribute, matching CSS cascade — unchanged from round 1)
   plus its **source** (`"style"` or `"attr"`). The `<text>`-with-no-own-`fill` special
   case now only fires when **no ancestor up to the `<svg>` root** has an own `fill`
   either (`ancestors.some((a) => a.type === "element" && ownColor(a, "fill") !== undefined)`).
   If any ancestor declares `fill` — regardless of its value — the descendant is left
   untouched: it inherits whatever that ancestor resolves to (a literal colour, a CSS
   variable, or, if the ancestor's own value is itself black, whatever class *the
   ancestor* gets on its own visit — inheritance carries the resolved value down for
   free, no need to touch the descendant). `stroke` deliberately gets **no** ancestor walk
   — its SVG initial value is `"none"`, not black, so there was never a default-injection
   bug for it; only the element's own `stroke` is classified, unchanged from round 1.

2. **CSS split by provenance** (`src/app/styles/theme.css`) — replaced the round-1 blanket
   `!important` with three specificity tiers per new `semanticClass(tone, prop, source)`:
   - `mv-diagram-{fg,bg}-{fill,stroke}` (no suffix, **no** `!important`) for colours that
     came from a presentation *attribute*. A presentation attribute already has the lowest
     possible priority in the cascade — a plain class rule beats it unconditionally, so
     `!important` was never needed for this path, and dropping it is precisely what lets
     the `#f59e0b`-vs-`black` repro resolve correctly: our class rule and the internal
     `.brand{fill:#f59e0b}` rule tie at the same specificity (one class selector each), and
     the internal `<style>` — embedded inside the SVG, later in the document than
     `theme.css` — wins the tie-break by source order, exactly like it would if our
     plugin didn't exist at all.
   - `mv-diagram-{fg,bg}-{fill,stroke}-style` (**with** `!important`) for colours that came
     from an inline `style="…"` attribute — the one case that genuinely needs it, since an
     inline style attribute outranks any non-`!important` stylesheet rule regardless of
     specificity.
   - `:where(.mv-diagram-fg-fill-default)` (zero specificity, **no** `!important`) for the
     true "nothing in the ancestor chain declared `fill`" default — it stands in for SVG's
     *initial value*, so it must lose to literally any real declaration, at any
     specificity, from anywhere.

   9 rules total (`fg-fill` × {attr, style, default}, `bg-fill` / `fg-stroke` /
   `bg-stroke` × {attr, style}).

**Verification beyond the unit-level class assertions:** confirmed by construction, not by
a browser (that's a separate mandatory node) — the specificity/`!important` tiering was
derived from CSS cascade rules (presentation attribute priority 0; inline `style` beats
any non-`!important` external rule; equal-specificity ties break on document order), and
the actual minified rule text was inspected in a real `mdxx` export (see `#B2` below) to
confirm the tiers landed exactly as designed, not just that the source `.css` said so.

**`dot` lane confirmed unaffected:** real Graphviz 15.1.0 output (checked again this
round) never uses inheritance for colour — every shape carries its own explicit `fill`
(`"none"` for edges/outlines, `"black"` for the arrowhead polygon), and `<g class="node">` /
`<g id="graph0">` never carry a `fill` themselves. The ancestor walk changes nothing about
`dot`-lane classification; it only stops the `svg`-lane over-reach.

### #B2 (P2) — the class→colour CSS binding had no test

Reviewer's proof: delete the four (now nine) semantic rules from `theme.css` and
`diagram-theme` + `mdx-pipeline` still pass fully — the class *placement* is guarded by
dozens of tests, but the CSS *declarations* those classes resolve to were guarded by
nothing. Added a test to `test/export.test.mjs` (already builds a real self-contained
export and reads the HTML) that greps the inlined `<style>` for each of the 9 selectors
and asserts its exact declaration text (e.g. `.mv-diagram-fg-fill-style` must be exactly
`fill:currentColor!important`, `:where(.mv-diagram-fg-fill-default)` must be exactly
`fill:currentColor` with no `!important`). Confirmed it bites: temporarily deleted the 9
rules from `theme.css`, re-ran `test/export.test.mjs` — the new test failed (8/9), all
others still passed; restored the file — 9/9 again. This is the exact reviewer-identified
gap, now closed at the layer where it actually lives (the export smoke test reads real
inlined CSS; a `diagram-theme.test.mjs` unit test never touches `theme.css`'s file
contents at all, so it structurally could not have caught this).

### #B6 (P2) — named-graph backdrop stripping was a latent bug fix, now pinned

Reviewer's finding: Graphviz interposes `<title>G</title>` between `<g id="graph0">` and
the backdrop polygon for **named** graphs (`digraph G { … }`), which the *original*
(pre-round-1) string regex — anchored on `>\s*<polygon` immediately following the opening
tag — never matched. Confirmed by direct wasm output inspection (both this round and
independently by the reviewer): `digraph { a }` (anonymous) produces no `<title>` there and
the old regex worked; `digraph G { a }` / `graph G { a -- b }` (named) both produce
`<title>G</title>` first and the old regex silently failed, leaving a white backing sheet
on named dot diagrams in dark mode. Round 1's structural match (filter `graph0`'s direct
`<polygon>` children by colour, not by position) already fixed this as a side effect,
but neither `HYPOTHESIS.md` nor round 1's `tdd-evidence.md` recognized it as an actual fix
rather than "same anchor, new implementation" — and `examples/demo.mdx:58`'s dot diagram
is anonymous, so no browser check could ever exercise this path. Added
`"dot 车道 · #B6 具名图（digraph G {...}）的背景多边形同样必须被剥掉"` to
`test/diagram-theme.test.mjs`, which also asserts the `<title>` premise itself (so the test
would fail loudly, not silently pass vacuously, if a future Graphviz version stopped
emitting it there).

### #B1 (P2) — `themeSvg` renamed to `normalizeSvgMarkup`

Its body has done no colour theming since round 1 (that logic moved to `themeColors`); the
old name and its own JSDoc ("only does colour-agnostic structural cleanup") were at odds,
inviting a future edit to add colour logic back into the string layer — the exact thing
this whole change moved away from. Renamed at both call sites (`dot`/`graphviz` lane,
`svg` lane) in `src/mdx/diagrams.mjs`. Pure rename, no behavior change, covered by the
same 35 `diagram-theme` tests passing unchanged.

### Red → green transcript (round 2)

Verified genuinely RED by `git stash push -- src/mdx/diagrams.mjs src/app/styles/theme.css`
(reverting to the pre-round-1 baseline, since nothing had been committed yet — this is a
*stronger* red baseline than "round 1 only", and still proves the point: none of these
class names or ancestor-aware behaviors existed before this round's product-code change),
running the full updated `test/diagram-theme.test.mjs` (both the round-1 tests, updated for
the new class-name suffixes, and the new `#A1`/`#B6` tests), then `git stash pop` to
restore:

```
$ node --test test/diagram-theme.test.mjs      (pre-round-2 baseline)
Exit: 1
ℹ tests 35
ℹ pass 8    # trivial boundary cases that happened to hold even under the original
            # pre-round-1 string-regex code (author-color preserved, non-text
            # unspecified-fill untouched, the anonymous-graph backdrop strip, and
            # a few #A1 cases whose assertion is "no class at all" — true by
            # accident since that code never added classes to anything)
ℹ fail 27

$ node --test test/diagram-theme.test.mjs      (after the round-2 fix)
Exit: 0
ℹ tests 35
ℹ pass 35
ℹ fail 0
```

`#B2`'s new export-level test was confirmed red→green by direct mutation instead (there is
no "before" product-code state to diff against — the test targets round-1's CSS, which
round 2 only re-tiers, so the meaningful RED proof is "does deleting the rules fail it",
not "did it fail before this round's code existed"):

```
$ <delete the 9 semantic rules from theme.css>
$ node --test test/export.test.mjs
Exit: 1, 8/9 pass — "图内语义色：class→真实颜色的绑定确实写进了导出产物" fails

$ <restore theme.css>
$ node --test test/export.test.mjs
Exit: 0, 9/9 pass
```

### Full suite after round 2

```
$ npm test
Exit: 0
ℹ tests 159
ℹ pass 159
ℹ fail 0
```

Was 149/149 after round 1. New total 159 = 149 + 9 (`test/diagram-theme.test.mjs` grew from
26 → 35: the `#B6` named-graph test, and 8 new `#A1` ancestor/provenance tests — one of
round 1's boundary tests split into two assertions rather than growing the count) + 1
(`test/export.test.mjs` grew from 8 → 9: the `#B2` CSS-binding pin). No other file's count
changed. Five round-1 tests had their expected class name updated in place (not counted as
new) to match the provenance-split names (`-default` for the SVG-initial-value stand-in,
`-style` for inline-`style`-sourced colours) — confirmed each still fails against the
pre-round-2 code and passes after, per the transcript above.

```
$ npm run test:unit
Exit: 0
ℹ tests 149
ℹ pass 149
ℹ fail 0
```
(149 = 140 (round 1) + 9, matching the `diagram-theme.test.mjs` delta; `test:unit` still
excludes `test/export.test.mjs`, so the `#B2` test isn't in this number — it's covered by
`npm test` above.)

### Constraints re-verified for round 2

- `git diff --stat ce99eab -- src/cli/vite-config.mjs src/mdx/plugins.mjs` → empty. Zero
  diff held.
- `mermaid` lane: untouched by any round-2 file (`diagrams.mjs`'s mermaid branch,
  `Layout.tsx`, and the mermaid CSS block are all outside this round's diff).
- `mdxv`/`mdxx` parity: both go through the same `rehypeDiagrams` and the same
  `theme.css`; re-verified by re-running the real `mdxx` export on `examples/demo.mdx`
  after round 2 and confirming (a) the Chinese-labeled `<text>` node now carries
  `mv-diagram-fg-fill-default` (not the round-1 plain `mv-diagram-fg-fill`, since it has no
  ancestor `fill` — correct per the new tiering) and (b) all 9 CSS rules are present with
  the exact declarations designed above.
- Nothing committed, per this repo's CLAUDE.md.

### Not in scope this round (recorded, not silently dropped)

- `#B3` (P2) — spelling-set enumeration still misses semantically-pure-black/white written
  as `hsl(0,0%,0%)`, `rgba(0,0,0,1)`, `#000f`, `rgb(0 0 0)`, etc. Controller explicitly
  deferred this (bigger change: parse-to-RGBA instead of enumerate; `dot` lane unaffected).
- `#B4` (P3) — scope the 9 selectors under `.mv-diagram` to shrink the `!important` blast
  radius. Not requested this round.
- `#B5` (P3) — point the `mdx-pipeline.test.mjs` integration assertion at `mv-diagram-fg-fill`
  (the actual bug) instead of `mv-diagram-fg-stroke` (which was already correct
  pre-fix). Not requested this round; the current assertion still bites (fails on the
  pre-fix string), it's just not witnessing the core regression at the integration layer.
- `#B7` (P3) — merge `stripGraphvizBackdrop` and `themeColors`'s two synthetic-root tree
  walks into one pass. Reviewer's own recommendation was to leave this alone (the ordering
  rationale is clearer as two named passes); not touched.
