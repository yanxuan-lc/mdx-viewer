# Proposal — localized document variants

Allow one logical MDX document to have product-locale-specific physical files. A base file such as
`README.mdx` is the fallback; `README.zh-CN.mdx` and `README.en-US.mdx` are exact variants. The browser
preview follows the active UI locale without duplicating logical documents in navigation.

The same change makes the sticky topbar 36px tall and gives every topbar control a localized,
accessible hover hint.

`mdxx` remains a single-physical-file exporter. It does not discover or bundle sibling variants.

