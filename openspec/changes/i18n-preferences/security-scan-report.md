# Security scan — i18n-preferences

status: clean at Medium-or-higher threshold — Critical: 0, High: 0, Medium: 0, Low: 0

- Scope: current codebase working tree; repository has no valid `HEAD`, so no commit stamp or history diff exists.
- SAST: manual JS/TS pattern audit run; `semgrep` is not installed. Reviewed new LocalStorage boundaries, CLI interpolation, DOM writes, `innerHTML`, `dangerouslySetInnerHTML`, process/file APIs and message interpolation. The changed render-error path uses React text escaping. Existing KaTeX trusted renderer and Mermaid document renderer are unchanged.
- Dependency audit: run.
- Secret scan: working-tree pattern scan run; `gitleaks` and `trufflehog` are not installed. Full-history scanning is not applicable because the repository has no committed history.

| Dimension | Command | Exit | Result |
|---|---|---:|---|
| dependency audit | `npm audit --registry=https://registry.npmjs.org --json` | 0 | 0 total vulnerabilities |
| secret patterns | `rg` for private-key headers, AWS/GitHub/OpenAI token shapes and password assignments, excluding dependencies/results | 0 | no matches |
| SAST patterns | `rg` for DOM HTML sinks, dynamic execution, process/file APIs and storage boundaries | 0 | no new exploitable finding |

Findings: none.

Tool availability caveat: Semgrep and dedicated secret scanners were unavailable, so those dimensions use scoped manual/static pattern review and must not be read as a full-history CodeQL/gitleaks attestation.
