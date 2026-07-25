# Specification — localized document variants

## Scenarios

- **S1 — Exact locale:** With `README.mdx` and `README.zh-CN.mdx`, active `zh-CN` renders the Chinese file.
- **S2 — Base fallback:** With no exact locale variant, the active locale renders the unsuffixed base file.
- **S3 — English variant:** Active `en-US` chooses `.en-US` when it exists before falling back to base.
- **S4 — Language switch:** Switching UI language persists `mv-locale` and navigates to the selected
  physical variant of the same logical document.
- **S5 — Direct variant URL:** Opening a locale-suffixed URL canonicalizes to the active locale's exact
  variant or base fallback.
- **S6 — Deduplicated navigation:** One document family appears once, with a locale-neutral label.
- **S7 — Dotted basename:** `release.v2.mdx` is a base file; only supported final locale suffixes are parsed.
- **S8 — Relative links:** Local relative `.md/.mdx` links continue to route, then resolve the target family
  using the active locale.
- **S9 — Demo:** `demo/index.mdx` is English and `demo/index.zh-CN.mdx` is the Chinese counterpart.
- **S10 — Export boundary:** `mdxx` exports only the explicitly selected physical file and remains offline.
- **S11 — Topbar geometry:** Computed topbar height is 36px and controls fit without overflow.
- **S12 — Hover/accessibility:** Menu, language and theme buttons expose localized matching `title` and
  `aria-label` values; keyboard focus remains visible.

