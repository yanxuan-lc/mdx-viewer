## ADDED Requirements

### Requirement: Browser locale resolution

The application SHALL support exactly `zh-CN` and `en` product Locales and SHALL resolve the browser Locale in this order: a valid `mv-locale` LocalStorage value; an injected CLI value sourced from `--lang` or `MDXV_LANG`; the browser primary language; an injected system/fallback value; then `en`. Simplified Chinese browser identifiers (`zh-CN`, `zh-SG`, `zh-Hans*`) SHALL map to `zh-CN`; every other browser language, including Traditional Chinese identifiers, SHALL map to `en`.

#### Scenario: S1 Simplified Chinese browser default

- **WHEN** a user clears `mv-locale`, supplies neither `--lang` nor `MDXV_LANG`, and opens a preview whose browser primary language is `zh-CN`
- **THEN** all product-owned UI initially renders in Simplified Chinese and `<html lang>` equals `zh-CN`
- **THEN** the application writes neither `mv-locale` nor `mv-theme` and performs no database write

#### Scenario: S2 Non-Simplified-Chinese browser default

- **WHEN** a user clears `mv-locale`, supplies neither `--lang` nor `MDXV_LANG`, and opens a preview whose browser primary language is `en-US`, `fr-FR`, or `zh-TW`
- **THEN** all product-owned UI initially renders in English and `<html lang>` equals `en`
- **THEN** the application writes neither `mv-locale` nor `mv-theme` and performs no database write

### Requirement: Runtime language switching and persistence

The toolbar SHALL expose a language button immediately to the left of the theme button. Activating it SHALL toggle `zh-CN ↔ en`, update all mounted product-owned messages and `<html lang>` in the same interaction, and persist the exact target Locale as raw string LocalStorage key `mv-locale`. A valid saved value SHALL take precedence over every injected or detected initial value on later loads.

#### Scenario: S3 Switch language and restore it

- **WHEN** a user starts in `zh-CN`, activates the language button, observes the mounted page, and reloads it
- **THEN** the button, navigation, TOC, empty/error labels, Grid default, Colophon fixed wording and accessibility labels use English immediately and after reload, while `<html lang>` equals `en`
- **THEN** LocalStorage contains `mv-locale=en`, no unrelated storage key changes, and no database write occurs

### Requirement: Theme preference cycle and live system following

The application SHALL support theme preferences `auto`, `light`, and `dark`. The toolbar button SHALL cycle `auto → light → dark → auto`, persist the selected raw string in `mv-theme`, expose it as `<html data-theme-preference>`, and expose the resolved CSS theme as `<html data-theme=light|dark>`. `auto` SHALL follow `(prefers-color-scheme: dark)` continuously; manual light/dark SHALL not respond to later system changes.

#### Scenario: S4 Cycle and restore all theme preferences

- **WHEN** a user starts at `auto`, activates the theme button three times with a reload after each activation
- **THEN** `data-theme-preference` is respectively `light`, `dark`, and `auto`; the icon and localized accessibility label describe the current/next choice; each reloaded page restores the same preference
- **THEN** LocalStorage contains the current raw `mv-theme` value after each action and no database write occurs

#### Scenario: S5 Follow system only in auto

- **WHEN** the active preference is `auto` and the browser color scheme changes light → dark → light, then the user selects manual `light` and the browser scheme changes again
- **THEN** `data-theme` follows both changes during auto and remains `light` after the manual selection
- **THEN** the system changes create no additional LocalStorage or database write

### Requirement: Frontmatter theme fallback

When `mv-theme` is absent or invalid, the application SHALL accept frontmatter `mode` only when it is exactly `auto`, `light`, or `dark`; otherwise it SHALL use `auto`. A valid saved `mv-theme` SHALL override frontmatter. Locale and theme attributes SHALL be applied before the first visible application render.

#### Scenario: S6 Resolve frontmatter and default theme

- **WHEN** `mv-theme` is absent and pages are loaded with frontmatter `mode: light`, `mode: dark`, `mode: auto`, an unsupported mode, and no mode
- **THEN** their initial `data-theme-preference` values are respectively `light`, `dark`, `auto`, `auto`, and `auto`, with `data-theme` resolved accordingly before visible content
- **THEN** no default is written to LocalStorage and no database write occurs

### Requirement: Safe preference persistence

Preference reads and writes SHALL catch LocalStorage access exceptions. Values outside their exact allowed sets SHALL be treated as missing, SHALL not be auto-rewritten, and SHALL enter the normal fallback rules. If a valid write fails, the selected value SHALL remain active in memory for the current page without crashing.

#### Scenario: S7 Recover from damaged or unavailable LocalStorage

- **WHEN** `mv-locale` and `mv-theme` contain unsupported strings, and separately when `getItem` or `setItem` throws, then the user loads the page and activates both controls
- **THEN** initial values follow browser/injected Locale and frontmatter/auto theme rules, the application stays usable, and successful in-memory toggles update DOM state
- **THEN** invalid stored values are not automatically rewritten, failed writes do not escape to the UI, and no database write occurs

### Requirement: Complete two-language product messages

The `zh-CN` and `en` message catalogs MUST have identical key sets and MUST cover navigation, TOC, empty states, render errors, control/accessibility labels, the Grid default filter, Colophon fixed wording, and CLI-owned help/status/error text. A missing key MUST fail a test or development render rather than silently borrowing the other Locale. Message interpolation MUST render parameters as text, not HTML.

The stable browser-facing translations used by scripted acceptance are:

| Family | `zh-CN` | `en` |
|---|---|---|
| Files | `文件` | `Files` |
| File menu | `文件菜单` | `File menu` |
| Close | `关闭` | `Close` |
| TOC | `目录` | `Contents` |
| Language action | `切换到英文` | `Switch to Chinese` |
| Theme names | `自动` / `浅色` / `深色` | `auto` / `light` / `dark` |
| Grid default | `全部` | `All` |
| Colophon, both fields | `由 {author} 编辑于 {datetime}` | `Edited by {author} on {datetime}` |
| Colophon, author only | `由 {author} 编辑` | `Edited by {author}` |
| Colophon, time only | `编辑于 {datetime}` | `Edited on {datetime}` |
| Render failure prefix | `MDX 渲染失败` | `MDX render failed` |

#### Scenario: S8 Exercise every fixed-message family

- **WHEN** scripted tests render both Locales and trigger the file drawer, TOC, each empty state, the render-error surface, each toolbar/a11y label, a filterable Grid, and every Colophon attribution form
- **THEN** every product-owned phrase comes from the selected complete catalog, no phrase leaks from the other catalog, and the two catalog key sets are equal
- **THEN** only deliberate language-button actions write `mv-locale`; no database write occurs

### Requirement: CLI language selection

Both `mdxv` and `mdxx` SHALL accept `--lang zh-CN|en`. CLI-owned output SHALL resolve by `--lang`, then `MDXV_LANG`, then Node system Locale, then `en`. Explicit values MUST match exactly; an invalid selected value SHALL emit localized `INVALID_LANGUAGE`, exit with status `1`, and SHALL not start a server or build an export. The virtual config SHALL include `{ initialLocale, localeSource }`, where source is `argument`, `environment`, `system`, or `fallback`.

#### Scenario: S9 Resolve CLI precedence and reject invalid values

- **WHEN** subprocess tests run both commands across these cases: valid flag conflicting with env; valid env without flag; Simplified-Chinese and non-Chinese system Locales without either; missing system Locale; invalid flag; invalid env
- **THEN** CLI help/status/error output and injected `{ initialLocale, localeSource }` select respectively flag, env, normalized system, or English fallback; invalid selected values produce a localized allowed-values error and exit `1`
- **THEN** an invalid invocation creates no server, output HTML, LocalStorage value, or database write

### Requirement: Self-contained localized export

`mdxx` SHALL use the same application, message catalogs, preference rules, and controls as preview mode while preserving a self-contained single HTML file with no external script, stylesheet, font, image, translation, or other runtime resource. A valid `--lang` or `MDXV_LANG` SHALL define the export's initial Locale when no saved browser preference exists.

#### Scenario: S10 Use preferences in an offline export

- **WHEN** a user runs `mdxx fixture.mdx out.html --lang en`, disconnects external network access, opens `out.html`, switches language and theme, and reloads in an offline browser environment where LocalStorage is available
- **THEN** the document initially uses English, remains readable with zero resource requests, both controls work, and reload restores `mv-locale` and `mv-theme`
- **THEN** only those two LocalStorage keys are written and no database write occurs

### Requirement: Author content remains untranslated

Locale switching SHALL affect only product-owned chrome and fixed component defaults. The application MUST NOT translate or mutate MDX prose, frontmatter values, file/directory names, code blocks, or author-supplied component props/children.

#### Scenario: S11 Preserve author-provided content

- **WHEN** a document containing Chinese and English prose, frontmatter title/footer, a non-ASCII filename, and custom component text is captured before and after a language toggle
- **THEN** every author-owned text node and value is unchanged while only product chrome switches Locale
- **THEN** the action writes only `mv-locale` and performs no database write

### Requirement: Compatibility and test carrier

The scenario set S1–S12 SHALL use the `scripted` execution carrier. Browser scenarios SHALL use Playwright against local preview/export artifacts, CLI scenarios SHALL use Node subprocess tests, pure resolution/catalog rules SHALL use `node:test`, and export compatibility SHALL use the real Vite build. Existing official MDX compilation, directory navigation, relative-link routing, and self-contained export behavior MUST continue to pass.

#### Scenario: S12 Preserve the compatibility baseline

- **WHEN** the full existing and new scripted suites run against MDX syntax/frontmatter/GFM/math/highlighting/three-lane diagrams, a multi-file directory, relative links, and the export fixture
- **THEN** all suites pass, no official MDX construct or directory route regresses, and exported HTML still has no external resource reference
- **THEN** test fixtures perform no database write; storage writes are limited to scenarios that explicitly exercise `mv-locale` or `mv-theme`
