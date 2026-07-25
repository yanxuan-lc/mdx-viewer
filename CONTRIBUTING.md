# Contributing to mdx-viewer

**English** · [简体中文](./CONTRIBUTING.zh-CN.md)

This project is developed entirely by **VibeCoding**: shipped code is written by AI agents working
from a committed spec, under human review, using the
[ExcaliVibe](https://github.com/yanxuan-lc/excalivibe) capability suite. Contributions are welcome
in that same shape — you bring the intent and the judgment, an agent produces the change, and the
reasoning trail is committed next to the code.

You do not need to run an agent to contribute. A precise issue is a first-class contribution: it is
the brief the pipeline starts from.

## What VibeCoding means here

- **Nobody hand-writes patches.** The human role is intent, acceptance criteria, review of the diff,
  and every irreversible action — commit, push, merge and publish are never automatic.
- **Every non-trivial change lands as an OpenSpec change.** A directory under
  `openspec/changes/<id>/` is committed with the code, so a reviewer can read what was asked, what
  was decided, and which gates passed.
- **Exception:** typos, wording, and one-line obvious fixes can go direct — they still have to pass
  the tests.

## Setup

Requirements: Node ≥ 20, git, and Claude Code (or Codex ≥ 0.117.0).

```bash
git clone https://github.com/yanxuan-lc/mdx-viewer.git
cd mdx-viewer
make install        # dependencies
make link           # optional: put mdxv / mdxx on your PATH
make demo           # sanity check — the component gallery should open
git switch dev      # dev is the working branch; main is release-only
```

Install the framework — Claude Code:

```bash
claude plugin marketplace add yanxuan-lc/excalivibe
claude plugin install gen-ai-development@excalivibe   # the development workflow suite
claude plugin install plugin-infra@excalivibe         # browser automation + the mdx-artifact skill
claude plugin marketplace update excalivibe           # later, to pull framework updates
```

Codex (CLI 0.117.0+):

```bash
codex plugin marketplace add yanxuan-lc/excalivibe
codex plugin add gen-ai-development@excalivibe
codex plugin add plugin-infra@excalivibe

# gen-ai-development's 9 subagents ship as standalone TOMLs — plugins do not
# auto-register custom-agent TOMLs, so install them separately:
git clone https://github.com/yanxuan-lc/excalivibe.git
mkdir -p ~/.codex/agents
cp excalivibe/codex/agents/*.toml ~/.codex/agents/
```

Start a new session after installing, so skills, MCP servers and subagents load. Without the TOML
copy step the pipeline roles below (`planner`, `developer`, `code-reviewer` …) simply will not exist.

The repository already carries its own agent contracts: [`AGENTS.md`](./AGENTS.md) holds the project
facts every agent reads (stack, tree, commands, test inventory, MDX compatibility baseline, pitfalls,
glossary) and [`CLAUDE.md`](./CLAUDE.md) holds the Claude Code specifics (subagent registry,
delegation rules). Do not restate project facts in your prompts — point the agent at those files.

## The development loop

Describe what you want in your own words — "give `Callout` a `tone=success`", "mermaid diagrams
render with the wrong theme in the `mdxx` export" — and let the autonomy controller route it. It
classifies the change (archetype / criticality / reversibility), sets an autonomy ceiling, and
assembles the track:

| Node | Owner | Output |
|---|---|---|
| `grill` | main agent | `BRIEF.md` — a sharp behavioral brief from a fuzzy ask |
| `design-spec` | `planner` | `proposal.md` · `design.md` · `specs/<capability>/spec.md` · `tasks.md` |
| `arch-review` | `arch-reviewer` | `REVIEW.mdx` — only when the spec carries a new interface, a cross-module split, or a removal |
| `implement` | `developer` | product code + unit tests, test-first; `tdd-evidence.md` |
| `e2e-author` | `e2e-author` | Playwright specs + `e2e-manifest.md`, in parallel with `implement` |
| `security` / `a11y` / `perf` gates | skills | `security-scan-report.md` · `a11y-report.md` · `perf-report.md` |
| `e2e-run` | `e2e-runner` | `e2e-report.md` — scenarios executed against a running app |
| `code-review` | `code-reviewer` | `CHECKLIST.md`, two separate verdicts (spec compliance, code quality) |
| `merge` | you | merge into `dev` |
| `archive` | `openspec archive <id>` | moves the change into `openspec/changes/archive/` and merges its spec into `openspec/specs/` |

Nodes that do not apply are recorded as skipped **with a reason** (`[-]`), never silently dropped.
For a complete real trail, read
[`openspec/changes/archive/2026-07-25-i18n-preferences/PIPELINE.md`](./openspec/changes/archive/2026-07-25-i18n-preferences/PIPELINE.md).

## The red lines

Every change is judged against these, agent-authored or not. They are the reason the project is what
it is.

1. **Official MDX compatibility is the hard line.** `src/mdx/plugins.mjs` is the compatibility core.
   Check plugin options and ordering against the official documentation before touching it (use
   Context7 in Claude Code, not recall). A change that breaks CommonMark + JSX + `{}` expressions +
   ESM `import`/`export` as officially specified is rejected regardless of what else it achieves.
2. **Export stays self-contained.** `mdxx` output must have zero external links — no CDN, no remote
   font, no remote script. Any new asset must be inlinable; if you add one, extend the export smoke
   test.
3. **Both paths stay consistent.** `src/mdx/plugins.mjs` and `src/cli/vite-config.mjs` are shared by
   `mdxv` (dev server) and `mdxx` (export). Touch either file and verify both paths still behave.
4. **Components extend by OCP.** One React component in `src/app/components/blocks.tsx` (or
   `client.tsx` if it needs the browser runtime) plus one row in the `src/app/mdx-components.tsx`
   map. The core render pipeline does not change.
5. **Semantic props only; colors live in `theme.css`.** Components take `tone` / `ratio` / `status`
   and never a color value. Light/dark, palette and density switch only through `data-theme` /
   `data-palette` / `data-density` on `<html>`.
6. **Product strings vs author content.** UI strings belong in `src/i18n/messages.mjs` and are looked
   up through `t()`. What an author writes in their MDX never enters that catalog and is never
   translated.
7. **Locale pairs stay in sync.** `zh-CN` and `en-US` move together — in `messages.mjs`, in `demo/`,
   and in the two READMEs.

### One downstream consumer to remember

ExcaliVibe's `plugin-infra` ships an `mdx-artifact` skill that writes `.mdx` and views it through the
global `mdxv`, and its component reference is pinned to a version of this package
(`mdx-viewer ≥ 0.2.0`, checked with `mdxv --version`). It is deliberately a quick-reference, not the
source of truth — this repository is. So when you add or change a component, a component prop, or a
frontmatter field, that skill's `SKILL.md` and `references/blocks.md` need the same edit afterwards.
Land it here first; note it in your PR so the framework side gets updated too.

## Verification before you open a PR

```bash
make test        # unit + integration + export smoke (no e2e)
make test-e2e    # Playwright end-to-end (first run: npx playwright install)
make demo        # eyeball the gallery in both themes and both languages
```

- **New pure-logic module** → add a `test/*.test.mjs`, and **add that file to the `test:unit` list in
  `package.json`**. The list is explicit; `make test-unit` will not pick it up otherwise.
- **Touched the compile pipeline** → add an assertion to `test/mdx-pipeline.test.mjs`, which compiles
  through the official `@mdx-js/mdx`.
- **Touched anything affecting self-containment** → assert it in `test/export.test.mjs`.
- **Touched browser behaviour** → add an `e2e/` spec. Note that any assertion about the table of
  contents needs a viewport wider than 1700px, because `theme.css` hides it below that (see the
  pitfalls in `AGENTS.md`).
- **"The build passed" is not verification for anything visual.** Open it and look — or screenshot it
  with the browser tooling.

## Branches, commits, pull requests

- `dev` is the working branch. `main` is release-only — never commit or push to it directly.
- Do feature work on a branch off `dev`, merge into `dev` once the review gate holds, and open a PR
  from `dev` into `main` only at release time.
- Conventional commit subjects, lowercase and imperative: `feat:` `fix:` `docs:` `test:` `build:`
  `refactor:` `chore:` `release:`.
- Write the body for a reader who was not there: what was wrong, what you decided, what you verified.
  Skim `git log` — that is the bar.
- Agent-authored commits carry a `Co-Authored-By:` trailer naming the model that wrote them.
- A pull request should contain the code, its tests, the `openspec/changes/<id>/` directory (spec,
  `PIPELINE.md`, gate reports), and documentation updates when user-visible behaviour changed —
  `README.md` and `README.zh-CN.md` together, plus `AGENTS.md` if a project fact changed.

## Reporting a bug or proposing a feature

Open an [issue](https://github.com/yanxuan-lc/mdx-viewer/issues).

- **Bugs:** the smallest `.mdx` that reproduces it, the exact command (`mdxv` or `mdxx`, with flags),
  Node version, OS, and expected versus actual. A five-line MDX file that fails is worth more than a
  paragraph of description.
- **Features:** the outcome you want and why the workaround hurts. You do not have to design it — the
  `grill` and `design-spec` steps exist for that.

Before filing, check `openspec/specs/` and the pitfalls section of `AGENTS.md`: some surprises are
documented behaviour (for example, the table of contents being invisible below a 1700px viewport, and
the colophon timestamp never being generated).

## Releases (maintainers)

`make publish` runs `scripts/publish.sh`: version verification, clean-tree and branch gates, the test
suite, then a publish to npmjs and a `v<version>` tag. `make publish-dry` rehearses it without
publishing or tagging. The version lives only in `package.json` — `publish.sh` and the export test
both read it, so nothing else needs bumping.

## License

By contributing you agree that your contribution is licensed under the project's [MIT](./LICENSE)
license.
