# Proposal — localized document variants

## Why

A bilingual document set holds several physical files per logical document. Navigation should show
one entry per logical document rather than one per physical file, and the preview should follow the
reader's active UI locale.

The same pass pins the sticky topbar to a fixed 36px height and gives every topbar control a
localized, accessible hover hint.

## What Changes

Allow one logical MDX document to have product-locale-specific physical files. A base file such as
`README.mdx` is the fallback; `README.zh-CN.mdx` and `README.en-US.mdx` are exact variants. The browser
preview follows the active UI locale without duplicating logical documents in navigation.

The same change makes the sticky topbar 36px tall and gives every topbar control a localized,
accessible hover hint.

`mdxx` remains a single-physical-file exporter. It does not discover or bundle sibling variants.

> The two section headers were added when this change was archived, to satisfy the proposal format.
> **What Changes** is the original proposal text verbatim; **Why** restates the intent already
> expressed in that text and in `design.md`'s UI design section. No new commitment was introduced.
