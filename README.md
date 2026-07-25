# mdx-viewer

**English** · [简体中文](./README.zh-CN.md)

A local MDX renderer. `mdxv <file|dir>` opens a browser preview; `mdxx <file>` exports a
self-contained, offline HTML file. Built on the official `@mdx-js` + Vite + React —
**100% compatible with official MDX syntax**, with extensible components.

## Positioning & Goals

- **Read MDX with one command.** Treat `.mdx` / `.md` as documents you just open — no need to
  scaffold a Next.js / Docusaurus site first.
- **Official standard is the hard line.** The foundation is the official reference compiler
  `@mdx-js/rollup` (MDX v3), so CommonMark + JSX + `{}` expressions + ESM `import`/`export`
  are all parsed to the official spec. The officially recommended extensions (GFM / frontmatter /
  math / syntax highlighting) are wired in as-is. Never break official compatibility when touching
  the compile pipeline.
- **One template, semantic components.** Ships a CSS-variable-driven HTML+CSS template and
  semantic components (Hero / Callout / Steps…); authors write `<Callout>` with no import. To
  extend, add one component plus one mapping line.
- **Export means offline.** `mdxx` produces a single HTML file with zero external links — KaTeX
  fonts and the Mermaid runtime (when used) are all base64-inlined, so it opens on a double-click
  and travels well as an email attachment.

## Install

```bash
make install       # install deps (= npm install)
make link          # optional: register mdxv / mdxx globally
```

> The single entry point is `make`: run `make` to list every command. You can also bypass the
> Makefile and use `npm` / `mdxv` / `mdxx` directly.

Get going with make:

```bash
make demo                             # open the built-in component gallery
make view FILE=doc.mdx                # preview (FILE may be a file or a directory)
make view FILE=./docs ARGS="--port 5000"
make export FILE=doc.mdx OUT=out.html # export a self-contained HTML
```

## Usage

```bash
mdxv demo              # open the bundled component gallery (covers every component + param)
mdxv doc.mdx           # root at the file's directory, open that file (hot-reloads on edit)
mdxv ./docs            # root at the directory, open the first doc (README/index preferred)
mdxv doc.mdx --port 5000 --host --no-open
mdxv doc.mdx --lang zh-CN
mdxx doc.mdx           # export doc.html (self-contained, zero external links, double-click to open)
mdxx doc.mdx out.html  # specify the output path
mdxx doc.mdx --lang en-US # choose the exported page's initial UI language
```

`mdxv` behaves **uniformly**: whether you pass a file or a directory, it operates on a single root
— a file roots at its parent directory and opens that file; a directory roots at itself and opens
the first doc. When the root holds multiple `.md`/`.mdx` files, a left-hand nav appears and relative
links cross-navigate; with a single doc, no nav is shown. To quickly see what every component looks
like, just run `mdxv demo`.

The browser UI supports Simplified Chinese and English. Its initial language follows the browser;
the CLI uses `--lang`, then `MDXV_LANG`, then the system Locale. The toolbar language control and
the `auto → light → dark` theme control save manual choices in LocalStorage. In `auto`, the page
continues to follow changes to the operating-system color scheme.

## Localized document variants

Directory previews can group an unsuffixed document with optional Simplified-Chinese and English
variants. Name sibling files with the locale immediately before the extension:

```text
guide.mdx          # base fallback
guide.zh-CN.mdx    # Simplified Chinese variant
guide.en-US.mdx       # English variant
```

The active UI language selects its exact variant first, then the unsuffixed base document. The
navigation shows one logical `guide.mdx` entry rather than one entry per physical variant. Opening a
localized `?doc=` URL is accepted and normalized to the active language when that family has a
matching variant or base fallback; relative Markdown links use the same family-aware routing.
Names other than the exact `.zh-CN` and `.en-US` suffixes are ordinary filenames. `mdxx <file>` remains
a physical-file exporter: it exports exactly the file you pass and never selects or bundles siblings.

## Relationship to Official MDX

The foundation is the official reference implementation `@mdx-js/rollup` (MDX v3), so
**CommonMark + JSX + `{}` expressions + ESM `import`/`export`** are all parsed to the official
spec. The officially recommended extensions are wired in as-is:

| Capability | Implementation | Syntax |
|---|---|---|
| GFM (tables / task lists / strikethrough) | `remark-gfm` | native Markdown |
| Frontmatter (full YAML) | `remark-frontmatter` + `remark-mdx-frontmatter` | `--- ... ---`, exported as `frontmatter` |
| Math | `remark-math` + `rehype-katex` | official `$...$` / `$$...$$` (plus a `<Math tex=…>` extension) |
| Syntax highlighting | `rehype-pretty-code` (Shiki) | ```` ```ts ```` dual theme, follows light/dark |

Extend with your own components on top of this (see below).

## Custom Components

Injected via `MDXProvider`, so authors write `<Callout>` and friends with **no import**:

`Hero` `Section` `Callout` `Card` `Columns` `Toggle` `Steps`/`Step` `Stats`/`Stat`
`Fields`/`Field` `Scenario`/`When`/`And`/`Then` `Grid`/`Item` (filterable) `Badge` `Figure`
`Math` `Code`. Styling uses only semantic props (`tone`/`ratio`/`status`) — no color values.

**Add a new component (OCP):** write a React component in `src/app/components/blocks.tsx` and
add one row to the mapping table in `src/app/mdx-components.tsx` — the core render pipeline stays
untouched.

## Diagrams

Carried by fenced code blocks; the fence language routes to one of three lanes:

| Fence | Engine | Runtime |
|---|---|---|
| `dot` / `graphviz` | build-time Graphviz (wasm) → static SVG | zero runtime |
| `mermaid` | client-side render, theme follows light/dark | loaded only when used |
| `svg` | inlined as-is | zero runtime |

## Frontmatter Fields

`title` `subtitle` `author` (required) `org` `copyright` `datetime` (`yyyy-MM-dd HH:mm:ss`) `footer`
`palette` (indigo/teal/rose/amber/lime) `mode` (light/dark/auto) `density` (comfortable/compact)
`toc` `hero` (false disables the auto Hero) `chrome` (off disables header/footer + colophon).

## Directory Structure

```
bin/          mdxv.mjs (preview) · mdxx.mjs (export)
src/
  cli/        input resolution · Vite config · virtual-module plugin
  mdx/        compile plugin list · three-lane diagram rehype plugin
  app/        React app: Layout · component library · theme.css · MDXProvider mapping
examples/     demo.mdx · guide/intro.md
```

## Architecture Notes

- **view**: `mdxv` starts the Vite dev server programmatically. A single doc loads via the virtual
  module `virtual:mdx-target`; directory mode scans `.md`/`.mdx`, serves `/__mdxv/tree`, and the
  frontend loads by `?doc=` and routes relative links.
- **build**: `mdxx` runs `vite build` + `vite-plugin-singlefile` with assets (including KaTeX fonts
  and the Mermaid runtime when used) all base64-inlined, producing a zero-external-link single HTML.

## Testing

Uses Node's built-in `node --test` — **zero third-party test dependencies**. Three layers under `test/`:

```bash
make test          # everything (unit + integration + export smoke)
make test-unit     # fast: pure logic + MDX compile pipeline (no vite build)
make test-export   # export self-containment smoke (real vite build, ~7s)
```

- **unit** — `src/cli/resolve.mjs` (`resolveInput` / `scanTree` / `pickDefaultDoc`), fixtures built in a temp dir.
- **integration** — runs `mdxOptions()` through the official `@mdx-js/mdx` `compile()`, asserting frontmatter / GFM / math / highlighting / the three diagram lanes all fire.
- **export smoke** — runs the real `mdxx` and asserts the output is zero-external-link and base64-inlined.

## Requirements

Node ≥ 20 (ESM). The CLI side is plain `.mjs`, run directly by Node with no build step; the browser
app is `.tsx`, transpiled by Vite with no separate tsc step.

## License

[MIT](./LICENSE) © yanxuan-lc
