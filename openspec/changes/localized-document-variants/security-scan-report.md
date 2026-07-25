# Security scan — localized-document-variants

**Status: clean at Medium+ — Critical 0, High 0, Medium 0, Low 0**

- Scope: current working tree; repository has no valid Git `HEAD`, so no commit stamp or history scan exists.
- SAST: manual change-scope review of locale filename parsing, absolute-path selection, URL updates and
  Vite file-tree exposure found no new injection, traversal, unsafe HTML or command execution path.
  Semgrep is not installed, so automated SAST was not run.
- Dependencies: `npm audit --registry=https://registry.npmjs.org --json` exited 0; 400 dependencies,
  0 vulnerabilities at every severity.
- Secrets: targeted repository scan for private-key headers, AWS keys and GitHub token shapes found
  no matches. Gitleaks is not installed; full-history scanning is impossible because the repository
  has an unborn history.

No finding meets the Medium blocking threshold. Tooling gaps are recorded and are not represented
as automated-clean evidence.

