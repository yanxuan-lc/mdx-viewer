# Accessibility report — localized-document-variants

**Verdict: PASS — WCAG 2.2 AA; budget: zero critical and zero serious violations**

## Audited surface

The changed `.mv-topbar` was audited in English and Simplified Chinese with axe-core 4.12.1.
Both states computed to 36px; menu, language and theme controls computed to 26px. Every control
had a non-empty localized `aria-label` exactly matching its native hover `title`.

| Locale | axe violations | Critical | Serious |
|---|---:|---:|---:|
| en-US | 0 | 0 | 0 |
| zh-CN | 0 | 0 | 0 |

The scripted browser suite additionally verifies keyboard focus changes visibly and that controls
remain within the topbar without overflow.

## Findings to verify

- Keyboard reachability/order: **verified-ok** by Playwright focus operation.
- Visible focus indicator: **verified-ok** by computed-style change and `:focus-visible` rule.
- Names, roles and values: **verified-ok** by axe and matching accessible-name assertions.
- Reflow at 200% / 320px: **needs-human**; no visual judgment is claimed.
- Motion: **verified-ok** for this static control surface; existing reduced-motion rules remain.
- Alt-text quality: not applicable to the topbar controls, which use labeled inline SVG icons.

Commit stamp is unavailable because the repository has no valid `HEAD`.

