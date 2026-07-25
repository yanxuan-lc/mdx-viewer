# Accessibility report — i18n-preferences

Verdict: PASS — WCAG 2.2 AA automated budget: zero critical and zero serious violations.

Commit stamp: unavailable (`HEAD` has no commit); audited current working tree on 2026-07-24.

## Surfaces and states

- Preview, English, light/reduced-motion, drawer closed.
- Preview, English, light/reduced-motion, drawer open.
- Preview, Simplified Chinese, light/reduced-motion, drawer closed.
- Changed controls: language toggle, auto/light/dark theme toggle, file drawer open/close.

## Detected violations

| State | Critical | Serious | Moderate | Minor |
|---|---:|---:|---:|---:|
| English, drawer closed | 0 | 0 | 0 | 0 |
| English, drawer open | 0 | 0 | 0 | 0 |
| Chinese, drawer closed | 0 | 0 | 0 | 0 |

Instrument: `axe-core` against WCAG 2 A/AA, 2.1 AA and 2.2 AA tags in Playwright Chromium. A first pass found hidden drawer controls exposed below `aria-hidden`; the product fix now toggles native `inert`. Chromium re-verification confirmed `inert=true` closed and `false` open.

## Findings to verify

| Area | Status | Evidence |
|---|---|---|
| Keyboard navigation | verified-ok | Toolbar controls use native buttons; Shift+Tab reached the file-menu button; closed drawer is inert. |
| Visible focus | verified-ok | Native focus outlines are not suppressed; brand link has an explicit `:focus-visible` state. |
| Screen-reader semantics | verified-ok | Buttons have localized accessible names and stateful menu button exposes `aria-expanded`. |
| Alt text | verified-ok | GitHub mark is decorative and hidden; its enclosing link has a localized accessible name. |
| ARIA correctness | verified-ok | axe reports no violations in closed/open states; `aria-hidden` and `inert` agree. |
| Reflow/zoom | needs-human | No screenshot/manual 200% zoom judgment was performed. |
| Motion | verified-ok | stylesheet retains the existing `prefers-reduced-motion` override; audit used reduced motion. |

Automated checks cover only machine-detectable WCAG criteria; the PASS verdict applies to the stated budget and surfaces, not all accessibility qualities.
