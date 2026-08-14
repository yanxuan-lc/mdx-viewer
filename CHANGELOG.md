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

## [0.4.0] — 2026-08-14

### Added

- **A user-level config file, and custom fonts as its first setting.** `~/.config/mdxv/config.json`
  (`$XDG_CONFIG_HOME` honored when absolute; comments and trailing commas tolerated) now sets the
  four font families — `font.sans`, `font.head`, `font.body`, `font.mono` — as a font name or an
  array of them. Matching `--font-sans|head|body|mono` options land on both `mdxv` and `mdxx`.
  Resolution order is fixed for every setting the file will ever carry: **CLI option > user config >
  built-in default**.

  Your families are *prepended* to the built-in chain rather than replacing it, so a Latin-only
  face takes over Latin and digits while CJK still falls through to the embedded Source Serif 4 and
  the system serif — no hand-written fallback chain. Both commands honor the file, so a preview
  shows what the export will use; the export records font **names** only and embeds no font files,
  keeping artifacts free of external links (a recipient without the font falls back down the chain).
  `mdxv --check` deliberately ignores the config, since fonts cannot affect whether a document
  compiles.

  A broken config never blocks a run: a missing file is silent, while an unreadable file, invalid
  JSON, a wrong field type, or an illegal font name each print one `Warning:` line to stderr and
  fall back to the built-in defaults. Font names admit only letters, digits, spaces and `. _ + -`;
  because these values are interpolated into a `<style>` block that ships inside exported HTML, one
  illegal name rejects its **whole** entry rather than partly applying.

- **`mdxv config set <key> <value>` writes that config, and is the only thing that creates it.**
  `mdxv config set font.body "Iowan Old Style"` creates the file and its directory on first use, so
  nobody has to hand-roll a JSON file to change a font; a comma-separated value names several
  families. It merges rather than replaces — your other settings, and any key it does not recognize,
  survive untouched.

  Where the read side degrades, the write side refuses: a config that cannot be parsed, or that
  holds a non-object at its top level or at `font`, is left **byte-identical** and the command exits
  1, because a rewrite that guesses is a rewrite that deletes someone's file. Rewriting a config
  that carries comments succeeds but warns that JSON cannot keep them. The write itself goes through
  a temporary file and a rename, so an interrupted run never leaves half a config behind.

### Fixed

- **Two `mdxv` instances no longer break each other's pages.** Every process shares one dependency
  pre-bundling cache (Vite resolves it from the package root, which never varies with the document
  root), and `react/jsx-dev-runtime` — present only in compiled MDX, which the dependency scanner
  never crawls — used to be discovered at runtime on the first document open. That discovery
  rewrote the whole cache directory, deleting chunk files the other instance had already served and
  leaving its page with a 404 (`The file does not exist at ... which is in the optimize deps
  directory`). Declaring the runtime up front makes a cold start's dependency set already final, so
  nothing re-optimizes; pre-bundling output is reproducible, so even simultaneous cold starts write
  identical filenames.

## [0.3.1] — 2026-08-12

### Fixed

- **Documents created after `mdxv` started never appeared in the file drawer.** The tree was
  scanned once at startup and served verbatim for the life of the server, and the browser
  fetched it once at boot — so neither side ever noticed the disk. `GET /__mdxv/tree` now
  rescans on every request, the document root is watched for `.md`/`.mdx` additions and
  removals, and the page refreshes the drawer in place without re-importing the open document.
  Deleting the document you are reading falls back to the "not found" state, and restoring it
  reopens it.

- **`mdxv --check` after a `--` terminator no longer claims check-mode exit codes.** Everything
  after a bare `--` stops being an option, so `mdxv --lang <bad> -- --check` is not a check run —
  but the bare-argv probe still saw the token and reported an argument-level failure as `2`
  ("the check could not run") instead of `1`. The probe now truncates at the first `--`, matching
  what the parser itself decides. Bare `--check` and `--check=<value>` are unaffected.

### Changed

- **`make publish-dry` runs from any branch again** (repository-only, not shipped in the package).
  The publish script stops a non-`main` publish outright rather than warning — the right call for
  an irreversible action — but the gate sits ahead of the dry run, so the rehearsal that exists
  precisely to be done *before* merging to `main` could not be done anywhere. The exemption now
  lives at the call site: `publish-dry` passes `ALLOW_NON_MAIN=1` itself, and the gate keeps
  telling the truth for real publishes. `ALLOW_NON_MAIN` is also listed in the script's own
  switch header now, where the other escape hatches were already documented.

- **The `mdxv` file drawer is now a real file tree.** Directories used to be one flat list of
  groups keyed by their whole path — `guide/advanced/internals` was a single row, and nesting was
  invisible. Every path segment now becomes its own collapsible level, directories sort before
  documents, and each level draws an indent guide. Collapse state is still remembered per
  directory path, and the directories enclosing the open document are always expanded, so a
  relative link that jumps into a collapsed directory no longer hides the highlighted entry.

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

[0.4.0]: https://github.com/yanxuan-lc/mdx-viewer/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/yanxuan-lc/mdx-viewer/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/yanxuan-lc/mdx-viewer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yanxuan-lc/mdx-viewer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yanxuan-lc/mdx-viewer/releases/tag/v0.1.0
