# localized-document-variants Specification

## Purpose

Defines how sibling documents that share a basename and differ only by a supported final locale
suffix (`.zh-CN`, `.en-US`) form one logical **document family** in directory preview. The active
UI language selects the exact variant, falling back to the unsuffixed base document; navigation
shows one entry per family rather than one per physical file, and `?doc=` URLs plus relative
Markdown links resolve family-aware.

Two boundaries are load-bearing. Only the exact supported suffixes carry this meaning — any other
dotted basename (`release.v2.mdx`) stays an ordinary filename. And `mdxx` is explicitly excluded:
it remains a physical-file exporter that ships exactly the file it is given and never selects,
substitutes, or bundles siblings.

This capability concerns document *selection*. The UI language that drives it is owned by
`i18n-preferences`.

## Requirements
### Requirement: Locale-aware document family selection

Directory preview SHALL group sibling documents that share a basename and differ only by a
supported final locale suffix (`.zh-CN`, `.en-US`) into one logical document family. Within a
family it SHALL render the exact variant for the active UI locale, and SHALL fall back to the
unsuffixed base document when that variant is absent.

#### Scenario: S1 Exact locale

- **WHEN** the root holds `README.mdx` and `README.zh-CN.mdx` and the active locale is `zh-CN`
- **THEN** the preview renders the Chinese file

#### Scenario: S2 Base fallback

- **WHEN** the active locale has no exact variant in the family
- **THEN** the preview renders the unsuffixed base file

#### Scenario: S3 English variant

- **WHEN** the active locale is `en-US` and an `.en-US` variant exists
- **THEN** that variant is chosen before the base fallback is considered

### Requirement: Language switch and direct variant URLs

Switching the UI language SHALL persist the choice and move to the selected physical variant of
the same logical document. A locale-suffixed `?doc=` URL SHALL be accepted and normalized to the
active locale's exact variant, or to the base fallback when no exact variant exists.

#### Scenario: S4 Language switch

- **WHEN** the UI language is switched while a family member is open
- **THEN** `mv-locale` is persisted and the preview navigates to the selected physical variant of
  the same logical document

#### Scenario: S5 Direct variant URL

- **WHEN** a locale-suffixed document URL is opened directly
- **THEN** it canonicalizes to the active locale's exact variant or to the base fallback

### Requirement: Family-aware navigation and link routing

Navigation SHALL show one entry per document family rather than one per physical variant, using a
locale-neutral label. Only the exact supported final locale suffixes SHALL carry family semantics;
any other dotted basename remains an ordinary filename. Relative local Markdown links SHALL keep
routing and SHALL resolve the target family using the active locale.

#### Scenario: S6 Deduplicated navigation

- **WHEN** a family has several physical variants
- **THEN** it appears once in the navigation with a locale-neutral label

#### Scenario: S7 Dotted basename

- **WHEN** a file is named `release.v2.mdx`
- **THEN** it is treated as a base file, because only supported final locale suffixes are parsed

#### Scenario: S8 Relative links

- **WHEN** a relative `.md` / `.mdx` link is followed
- **THEN** it routes as before and then resolves the target family using the active locale

### Requirement: Bilingual bundled demo

The bundled component gallery SHALL ship as a document family so `mdxv demo` follows the active
UI language.

#### Scenario: S9 Demo

- **WHEN** the bundled demo is opened
- **THEN** `demo/index.mdx` serves as the English document and `demo/index.zh-CN.mdx` as its
  Chinese counterpart

### Requirement: Export boundary

`mdxx` SHALL remain a physical-file exporter: it exports exactly the file it is given and SHALL
NOT select, substitute, or bundle sibling variants. The exported file SHALL remain offline and
free of external links.

#### Scenario: S10 Export boundary

- **WHEN** `mdxx` is given one member of a document family
- **THEN** only that physical file is exported and the output makes no external request

### Requirement: Topbar presentation and accessibility

Adding the language control SHALL NOT change topbar geometry or degrade accessibility. The menu,
language, and theme controls SHALL expose localized `title` and `aria-label` values that match
each other, and keyboard focus SHALL stay visible.

#### Scenario: S11 Topbar geometry

- **WHEN** the topbar renders with the language control present
- **THEN** its computed height is 36px and the controls fit without overflow

#### Scenario: S12 Hover and accessibility

- **WHEN** the menu, language, and theme buttons are inspected
- **THEN** each exposes localized, mutually matching `title` and `aria-label` values and keeps
  keyboard focus visible

