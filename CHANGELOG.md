# Changelog

All notable changes to `mdx-viewer` are recorded here. This file is the index; each entry
links to its GitHub release, which carries the full prose — mechanisms, boundaries and the
"what you may notice" details that matter when a change touches how your documents render.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). While the major version
is `0`, breaking changes are expressed as a **minor** bump.

**The versioned surfaces** are the CLI contract (flag names, exit codes, which stream output
goes to) and the author surface (components, component props, frontmatter fields). Rendered
pixels are not a contract: a fix to make invisible text visible necessarily changes them, and
such changes are called out per release instead.

## [0.3.1] — 2026-07-31

### Fixed

- **Documents created after `mdxv` started never appeared in the file drawer.** The tree was
  scanned once at startup and served verbatim for the life of the server, and the browser
  fetched it once at boot — so neither side ever noticed the disk. `GET /__mdxv/tree` now
  rescans on every request, the document root is watched for `.md`/`.mdx` additions and
  removals, and the page refreshes the drawer in place without re-importing the open document.
  Deleting the document you are reading falls back to the "not found" state, and restoring it
  reopens it.

## [0.3.0] — 2026-07-28

[Release notes](https://github.com/yanxuan-lc/mdx-viewer/releases/tag/v0.3.0)

### Added

- `mdxv --check` — compile every document without starting a server, so you can tell whether a
  document opens *before* handing the link over. Exit codes `0` pass / `1` a document failed /
  `2` the check could not run; report on stdout, `Error:` diagnostics on stderr, no ANSI bytes
  in the report. Also available as `make check-mdx FILE=<file|dir>`. Roughly 10× faster than
  the previous workaround of using `mdxx` export as a validity check.
- `CONTRIBUTING.md` / `CONTRIBUTING.zh-CN.md` (repository-only, not shipped in the package).

### Fixed

- **Diagram text was invisible in dark mode.** Graphviz emits `<text>` with no `fill`, and
  SVG's initial `fill` is `black` rather than `currentColor`, so no amount of `color` on the
  container reached it. Colour mapping moved from a string regex to the hast tree, shared by
  the `dot` and `svg` lanes, so preview and export agree. Measured contrast 13.42:1 dark /
  13.84:1 light.
- Named graphs (`digraph G { … }`) kept a white backing sheet in dark mode: Graphviz interposes
  a `<title>`, which the old position-anchored regex never matched.
- A `style` attribute written on the root `<svg>` was silently discarded — the old
  implementation concatenated a second `style` attribute into the markup string, and HTML
  parsing keeps only the first.

### Changed — may alter how existing diagrams render

Only relevant if you hand-write `svg`-lane diagrams; the `dot` / `graphviz` / `mermaid` lanes
should simply become readable in dark mode.

- Author-written pure white now maps to the theme background (pure black to the theme
  foreground). Translucent colours such as `rgba(0,0,0,.5)` are left alone.
- When nothing declares `fill`, the root `<svg>` receives `fill="currentColor"` and it flows
  down by inheritance — so any declaration of yours still wins, including one from an in-SVG
  `<style>` or a `<use>` site.
- The responsive-sizing inline `style` is no longer injected onto your root `<svg>`; it
  duplicated a `theme.css` rule and fullscreen zoom never depended on it.
- `<mask>` / `<clipPath>` subtrees are excluded from colour mapping, and the value their
  content would have inherited is pinned back. This isolation is a heuristic, not a guarantee:
  rules inside an in-SVG `<style>` are invisible at this layer, so a diagram whose `<style>`
  declares `fill` or `stroke` has its masks left entirely alone. See the release notes.

### Dependencies

- `unist-util-visit-parents@^6.0.0` promoted from a transitive to an explicit dependency.

## [0.2.0] — 2026-07-25

[Release notes](https://github.com/yanxuan-lc/mdx-viewer/releases/tag/v0.2.0)

### Added

- Bilingual interface (Simplified Chinese / English) with `--lang`, `MDXV_LANG` and system
  locale precedence, plus a persisted manual choice. Author content is never translated.
- Three-state `auto → light → dark` theme control, persisted; `auto` keeps following the OS.
- Localized document variants: `guide.zh-CN.mdx` / `guide.en-US.mdx` collapse into one logical
  `guide.mdx` in directory previews, with family-aware relative links.
- Fullscreen diagram viewer with cursor-anchored zoom, drag-pan and Esc to exit; zoom changes
  the SVG's intrinsic size rather than using CSS `transform`, so it stays vector-crisp.
- Structured, localized CLI help and status output; ANSI colour only on a TTY.

### Fixed

- `react` / `@mdx-js` imports resolve correctly for documents outside the package tree.
- Lighter, less yellow light-theme background.
- Graphviz output is transparent, matching the `mermaid` lane.

## [0.1.0] — 2026-07-25

First public release: the MDX renderer, the `mdxv` preview server and the `mdxx`
self-contained single-file export, plus the semantic component set and the gated publish
pipeline.

[0.3.0]: https://github.com/yanxuan-lc/mdx-viewer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yanxuan-lc/mdx-viewer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yanxuan-lc/mdx-viewer/releases/tag/v0.1.0
