import { relative } from "node:path";
import { t } from "../i18n/locale.mjs";

/**
 * Decide whether terminal presentation may include ANSI styling.
 * @param {{isTTY?: boolean, env?: NodeJS.ProcessEnv}} options terminal environment
 * @returns {boolean} whether color is enabled
 */
export function isColorEnabled({ isTTY = false, env = process.env } = {}) {
  return Boolean(isTTY && env.NO_COLOR === undefined);
}

/**
 * Decide colouring for check mode separately per stream it actually writes — the report
 * (stdout) and the `Error:` diagnostic (stderr) can disagree, e.g. `mdxv --check dir >report
 * 2>err` where stdout is a file and stderr is still a terminal. Reusing one process-wide
 * decision would leak ANSI into the captured report.
 * @param {{stdoutIsTTY?: boolean, stderrIsTTY?: boolean, env?: NodeJS.ProcessEnv}} options terminal environment per stream
 * @returns {{report: boolean, diagnostic: boolean}} whether each stream may carry ANSI
 */
export function resolveCheckColors({ stdoutIsTTY = false, stderrIsTTY = false, env = process.env } = {}) {
  return {
    report: isColorEnabled({ isTTY: stdoutIsTTY, env }),
    diagnostic: isColorEnabled({ isTTY: stderrIsTTY, env }),
  };
}

/**
 * Render a command-specific CLI help page.
 * @param {{command: "mdxv" | "mdxx", locale: "zh-CN" | "en-US", color?: boolean}} options help context
 * @returns {string} plain-text help page
 */
export function formatHelp({ command, locale }) {
  const isPreview = command === "mdxv";
  const argumentRows = isPreview
    ? [["<file|dir|demo>", t(locale, "cli.viewArgument")]]
    : [["<file>", t(locale, "cli.exportInputArgument")], ["[output]", t(locale, "cli.exportOutputArgument")]];
  const optionRows = [
    ["-h, --help", t(locale, "cli.helpHelp")],
    ["-v, --version", t(locale, "cli.helpVersion")],
    ["--lang <locale>", t(locale, "cli.optionLanguage")],
    ...(isPreview ? [["--port <port>", t(locale, "cli.optionPort")], ["--host", t(locale, "cli.optionHost")], ["--no-open", t(locale, "cli.optionOpen")], ["--check", t(locale, "cli.optionCheck")]] : []),
  ];

  const syntax = isPreview ? "[OPTIONS] <file|dir|demo>" : "[OPTIONS] <file> [output]";
  const notes = isPreview ? `\n\nNotes:\n  ${t(locale, "cli.checkBoundaryNote")}` : "";
  return `Usage:\n  ${command} ${syntax}\n\nArguments:\n${formatRows(argumentRows)}\n\nOptions:\n${formatRows(optionRows)}${notes}`;
}

/**
 * Render a localized CLI error without exposing implementation stacks.
 * @param {{locale: "zh-CN" | "en-US", message?: string, parserError?: {message?: string}, color?: boolean}} options error context
 * @returns {string} user-facing diagnostic
 */
export function formatError({ locale, message, parserError, color = false }) {
  const detail = parserError ? formatParserMessage(parserError, locale) : message;
  const label = colorize(t(locale, "cli.errorLabel"), "31", color);
  return `${label}: ${detail}`;
}

/**
 * Render the preview startup status panel.
 * @param {{locale: "zh-CN" | "en-US", version: string, root: string, doc: string, count: number, url: string, color?: boolean}} options preview details
 * @returns {string} status panel
 */
export function formatPreviewSuccess({ locale, version, root, doc, count, url, color = false }) {
  const rows = [
    [t(locale, "cli.versionLabel"), `mdx-viewer v${version}`],
    [t(locale, "cli.rootLabel"), root],
    [t(locale, "cli.defaultDocumentLabel"), doc],
    [t(locale, "cli.documentCountLabel"), String(count)],
    [t(locale, "cli.openLabel"), `→ ${colorize(url, "4;36", color)}`],
  ];
  return `${formatSuccessHeading(t(locale, "cli.previewReady"), color)}\n${formatStatusRows(rows, color)}\n\n  ${t(locale, "cli.stopHint")}`;
}

/**
 * Render the completed export status panel.
 * @param {{locale: "zh-CN" | "en-US", version: string, source: string, output: string, size: string, color?: boolean}} options export details
 * @returns {string} status panel
 */
export function formatExportSuccess({ locale, version, source, output, size, color = false }) {
  const rows = [
    [t(locale, "cli.versionLabel"), `mdx-viewer v${version}`],
    [t(locale, "cli.sourceFileLabel"), source],
    [t(locale, "cli.outputFileLabel"), output],
    [t(locale, "cli.fileSizeLabel"), size],
  ];
  return `${formatSuccessHeading(t(locale, "cli.exportReady"), color)}\n${formatStatusRows(rows, color)}\n\n  ${t(locale, "cli.openFileHint")}`;
}

/**
 * Render a checked document's path relative to the current working directory, falling
 * back to the absolute path when the relative form would escape upward — so a consumer
 * piping the report can always copy-paste it back into a shell.
 * @param {string} abs absolute document path
 * @param {string} [cwd] current working directory
 * @returns {string} relative or absolute path, raw and uncoloured
 */
export function formatCheckPath(abs, cwd = process.cwd()) {
  const rel = relative(cwd, abs);
  return rel.startsWith("..") ? abs : rel;
}

/**
 * Render one `--check` report line: a passing `✓ <path>`, a failure with position
 * `✗ <path>:<line>:<column>  <reason>`, or — when the compile failure carries no
 * position — a degraded `✗ <path>  <reason>` with no fabricated `:line:column`.
 * @param {import("./compile-check.mjs").DocumentCheckResult} result one document's outcome
 * @param {{cwd?: string, color?: boolean}} [options] presentation context
 * @returns {string} one report line; colour applies only to the `✓`/`✗` mark
 */
export function formatCheckLine(result, { cwd, color = false } = {}) {
  const path = formatCheckPath(result.abs, cwd);
  if (result.ok) return `${colorize("✓", "32", color)} ${path}`;
  const position = result.line !== undefined && result.column !== undefined ? `:${result.line}:${result.column}` : "";
  return `${colorize("✗", "31", color)} ${path}${position}  ${result.reason}`;
}

/**
 * Render the `--check` summary line, printed only when the document set holds more
 * than one document.
 * @param {{passed: number, failed: number}} counts aggregate outcome from `checkDocuments`
 * @param {{locale: "zh-CN" | "en-US"}} options presentation context
 * @returns {string} localized, uncoloured summary line
 */
export function formatCheckSummary({ passed, failed }, { locale }) {
  return t(locale, "cli.checkSummary", { passed, failed });
}

/** @param {string[][]} rows @returns {string} aligned CLI rows */
function formatRows(rows) {
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, description]) => `  ${label.padEnd(width)}  ${description}`).join("\n");
}

/** @param {string} heading @param {boolean} color @returns {string} */
function formatSuccessHeading(heading, color) {
  return `${colorize("✓", "32", color)} ${colorize(heading, "1;32", color)}`;
}

/** @param {string[][]} rows @param {boolean} color @returns {string} */
function formatStatusRows(rows, color) {
  const width = Math.max(...rows.map(([label]) => displayWidth(label)));
  return rows
    .map(([label, value]) => `  ${colorize(label + " ".repeat(width - displayWidth(label)), "36", color)} : ${value}`)
    .join("\n");
}

/** @param {{message?: string}} error @param {"zh-CN" | "en-US"} locale @returns {string} */
function formatParserMessage(error, locale) {
  if (error.code === "EXTRA_ARGUMENTS") {
    return `${t(locale, "cli.invalidArguments")} ${t(locale, "cli.tooManyArguments", error.params)}`;
  }
  const message = String(error.message ?? "");
  const unknown = message.match(/^Unknown option `([^`]+)`$/);
  if (unknown) return `${t(locale, "cli.invalidArguments")} ${t(locale, "cli.unknownOption", { option: kebabOptionName(unknown[1]) })}`;

  const missingValue = message.match(/^option `([^`]+)` value is missing$/);
  if (missingValue) return `${t(locale, "cli.invalidArguments")} ${t(locale, "cli.optionValueMissing", { option: missingValue[1] })}`;

  return t(locale, "cli.invalidArguments");
}

/** @param {string} value @param {string} code @param {boolean} enabled @returns {string} */
function colorize(value, code, enabled) {
  return enabled ? `\u001B[${code}m${value}\u001B[0m` : value;
}

/** @param {string} option @returns {string} */
function kebabOptionName(option) {
  return option.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** @param {string} value @returns {number} terminal display columns */
function displayWidth(value) {
  return Array.from(value).reduce((width, character) => {
    const codePoint = character.codePointAt(0);
    return width + (isFullWidthCodePoint(codePoint) ? 2 : 1);
  }, 0);
}

/** @param {number} codePoint @returns {boolean} whether a code point occupies two terminal columns */
function isFullWidthCodePoint(codePoint) {
  return codePoint >= 0x1100 && (
    codePoint <= 0x115f
    || codePoint === 0x2329
    || codePoint === 0x232a
    || (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
    || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
    || (codePoint >= 0xff00 && codePoint <= 0xff60)
    || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
    || (codePoint >= 0x1f300 && codePoint <= 0x1f64f)
    || (codePoint >= 0x1f900 && codePoint <= 0x1f9ff)
    || (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}
