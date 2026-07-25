## ADDED Requirements

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
