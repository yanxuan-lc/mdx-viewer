# cli-output Specification

## Purpose

Defines how the `mdxv` and `mdxx` terminal surface presents itself: command help, structured
success/status panels, and expected-error diagnostics. The aim is output that is predictable and
localized, degrades cleanly to plain text when the stream is not a TTY, and keeps paths and URLs
raw so they stay copyable and scriptable. Expected input failures are reported as one localized
diagnostic plus complete help — never a stack trace.

Scope is CLI-owned presentation only. It does not cover browser UI text (see `i18n-preferences`)
or how command arguments are resolved into documents.

## Requirements
### Requirement: Standard command help

The CLI SHALL render command-specific help with `Usage:`, `Arguments:`, and `Options:`
sections and SHALL show that help after an argument-parser failure.

#### Scenario: S1 Explicit help

- **WHEN** `mdxv --help` or `mdxx --help` is executed
- **THEN** the process exits 0 and prints the command's standard sections and syntax

#### Scenario: S2 Invalid or missing arguments

- **WHEN** either command receives an unknown option, a missing option value, surplus
  positional arguments, or no required input
- **THEN** it exits 1, prints one localized diagnostic followed by complete help, and prints no stack

### Requirement: Structured success output

The CLI SHALL display structured, localized status panels. It SHALL use ANSI styling only
when color is enabled for a TTY and SHALL preserve raw copyable paths and URLs.

#### Scenario: S3 Plain-text status

- **WHEN** preview or export status is formatted for a non-TTY stream
- **THEN** every required field and next action is present with aligned labels and no ANSI sequence

#### Scenario: S4 Colored status

- **WHEN** status is formatted with color enabled
- **THEN** semantic headings, labels, success marks, and links contain ANSI styling without changing their text

