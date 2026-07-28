# Security Scan — mdx-compile-check

**Status: `not-clean (advisory only) — Critical: 0, High: 0, Medium: 0, Low: 1, Info: 4`**

No finding at or above Medium. The single Low is a local-CLI availability concern, not a
vulnerability. Whether any of this blocks is the caller's decision, not this report's.

## Scope

- **Change scope** — the diff of `mdx-compile-check`: `src/cli/compile-check.mjs` (new),
  `src/cli/output.mjs`, `bin/mdxv.mjs`, `src/i18n/messages.mjs`, `package.json`, `Makefile`,
  and the three new test files. Zero new dependencies.
- **Secret scan: full git history**, not just the diff — the question "has anything ever
  leaked" cannot be answered from a diff.
- **Tree state:** uncommitted working tree on branch `dev`, base commit `15433c9`. This report
  is current for that tree; any later edit invalidates it.

## Dimensions

| Dimension | Status | Invocation / exit |
|---|---|---|
| Dependency audit | ✅ **run** | `npm audit --registry=https://registry.npmjs.org` → `found 0 vulnerabilities` (the project's default mirror `registry.npmmirror.com` returns `NOT_IMPLEMENTED` for the audit endpoint, so the official registry was used explicitly) |
| Secret scan | ⚠️ **run, degraded** | No `gitleaks` / `trufflehog` / `detect-secrets` installed. Substituted targeted pattern matching over the change **and** full history (`git log --all -p` piped through a credential-shaped regex), plus a `key=realvalue` shape check, `.env`-ever-committed check, and `.gitignore` coverage check |
| SAST | ❌ **NOT run by tool** | No `semgrep` / `njsscan` / `osv-scanner` installed; installing semgrep (~100 MB, Python toolchain) is disproportionate to a 74-line module and would mutate the environment. **Substituted a targeted manual review** — recorded below. This dimension must be read as *not tool-verified*. |

**Do not read this report as tool-clean SAST.** The dependency dimension is genuinely
tool-verified; the secret dimension is degraded-but-broad; SAST is manual only.

## The load-bearing security property, verified empirically

`--check` compiles documents that are, by the change's own motivation, **machine-generated and
untrusted**. So the question that matters is whether compiling evaluates them. It does not:

```
export const boom = (() => { throw new Error("EXECUTED_AT_COMPILE") })()
{(() => { throw new Error("EXPR_EVALUATED") })()}
<Foo bar={(() => { throw new Error("PROP_EVALUATED") })()} />
```
→ `✓`, exit 0. And:
```
import { execSync } from "node:child_process"
{execSync("touch /tmp/mdxv-check-pwned")}
```
→ `✓`, exit 0, and `/tmp/mdxv-check-pwned` **was not created**.

MDX compilation parses expressions with acorn and emits them as source; it never evaluates
them. `remark-mdx-frontmatter` parses YAML with the `yaml` package's safe default schema (no
arbitrary object construction). So `mdxv --check` on a hostile document is a parse, not an
execution. This is the property that makes the gate safe to run in an automated pipeline, and
it is now regression-relevant: **any future change that evaluates document code at check time
would be a privilege escalation, not a feature.**

## Findings

| # | Severity | Location | What | Remediation |
|---|---|---|---|---|
| L-1 | **Low** | `src/cli/compile-check.mjs:42-54` | No timeout or size bound on compilation, and documents are processed sequentially — a pathological `dot`/`mermaid` fence or a very large document can stall or exhaust memory for the whole run (one bad document blocks the remaining ones). Availability-only, and the input is supplied by the invoking user on their own machine. | Accept for a local CLI. If `--check` is ever wired into CI over third-party content, add a per-document timeout and a size ceiling. |
| I-1 | Info | `bin/mdxv.mjs` (`--check` input resolution) | `--check <path>` reads any path the invoking user names, via the existing `resolveInput`/`scanTree`. **No privilege boundary is crossed** — identical trust model to the pre-existing `mdxv <file>` and `mdxx <file>`, and the user already holds read access. `scanTree` additionally skips dotfiles and `node_modules`. Not a path-traversal vulnerability: there is no untrusted input source and no elevated context. | None. |
| I-2 | Info | `src/cli/compile-check.mjs:26-31` | Compile failure `reason` text originates upstream and can quote a fragment of the offending source line; that text is echoed to **stdout**. The invoker already owns the file, so no boundary is crossed — but a caller piping check reports into a shared log could incidentally copy document content there. | None required. Worth a line in the consumer's docs if reports are ever centralised. |
| I-3 | Info | `src/cli/compile-check.mjs:60-73` | Unreadable files are caught and reported as a failed document carrying the raw OS error message (e.g. `EACCES`), which includes the absolute path. Intended behaviour (spec D5) and paths are printed by design. | None. |
| I-4 | Info | `scripts/publish.sh:128` — **pre-existing, outside this change** | Matched by the credential regex: writes `//registry.npmjs.org/:_authToken=%s` from the `$TOKEN` environment variable. This is the correct pattern (env-sourced, not hardcoded). Reported only because the scan surfaced it. | None. Out of scope for this change. |

## Secret scan detail

- **Change files:** no hits.
- **Full history:** 39 regex hits, **all word-level false positives** — "语义 token" (design
  tokens) and documentation of the publish script "读 `.env` token". A follow-up
  `key=realvalue`-shaped check returned **zero** matches, i.e. no literal credential in any
  commit reachable from any ref.
- **`.env` was never committed** (`git log --all --diff-filter=A` over `^\.env` → empty), and
  `.gitignore:8-9` covers `.env` and `.env.*`.

## Manual SAST review (substituting for the absent tool)

- Dangerous-API grep over product code (`eval`, `new Function`, `child_process`, `execSync`,
  `spawnSync`, `vm.`, dynamic `require`, `__proto__`) → **no hits**.
- No injection surface: nothing in this change builds a shell command, a SQL string, or a
  template; the only external input is file content handed to a parser.
- No crypto, no network, no deserialization of untrusted binary formats.
- `src/cli/compile-check.mjs` performs no process/stream/locale access, so it cannot leak via
  those channels; presentation is confined to `src/cli/output.mjs`.
- **Residual risk from the missing tool:** a rule-based scanner might still flag patterns this
  manual pass did not consider. Given the change's size (one 74-line module plus wiring) and
  the absence of any injection/crypto/network surface, the residual is judged small — but it is
  non-zero and is recorded here rather than hidden.

## Non-security observation, routed onward

A top-level `export` whose initializer throws (`export const boom = (() => { throw … })()`)
passes `--check` and then fails at module evaluation in the browser. That is the *same class*
as tier B's "undefined identifiers in `{…}`" in the spec's documented boundary, but it is a
third shape not named there. Not a security finding — handed to `code-review` as an input on
whether tier B's wording should name it.
