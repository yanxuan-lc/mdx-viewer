import { isLocale, normalizeSystemLocale, t } from "../i18n/locale.mjs";

/** @typedef {{locale: "zh-CN" | "en-US", source: "argument" | "environment" | "system" | "fallback"}} CliLanguage */

/** An expected, localized-at-the-boundary CLI input failure. */
export class CliLanguageError extends Error {
  constructor(value, locale) {
    super("INVALID_LANGUAGE");
    this.name = "CliLanguageError";
    this.code = "INVALID_LANGUAGE";
    this.locale = locale;
    this.params = { value, allowed: "zh-CN or en-US" };
  }
}

/** Expected CLI option failure for a flag whose required value is absent. */
export class CliOptionValueError extends Error {
  constructor(option, locale) {
    super("OPTION_VALUE_MISSING");
    this.name = "CliOptionValueError";
    this.code = "OPTION_VALUE_MISSING";
    this.locale = locale;
    this.params = { option };
  }
}

/** Expected CLI failure for surplus positional arguments. */
export class CliArgumentsError extends Error {
  constructor(arguments_) {
    super("EXTRA_ARGUMENTS");
    this.name = "CliArgumentsError";
    this.code = "EXTRA_ARGUMENTS";
    this.params = { arguments: arguments_.join(" ") };
  }
}

/** Expected export failure whose cause remains available to programmatic diagnostics. */
export class CliOutputError extends Error {
  constructor(path, cause) {
    super("EXPORT_FAILED", { cause });
    this.name = "CliOutputError";
    this.code = "EXPORT_FAILED";
    this.params = { path };
  }
}

/** @param {(() => string) | undefined} getSystemLocale @returns {CliLanguage} */
function systemLanguage(getSystemLocale) {
  try {
    const value = getSystemLocale?.();
    return typeof value === "string" ? { locale: normalizeSystemLocale(value), source: "system" } : { locale: "en-US", source: "fallback" };
  } catch {
    return { locale: "en-US", source: "fallback" };
  }
}

/**
 * Extract one strict raw --lang value without trusting CAC's later option parsing.
 * @param {string[]} argv raw argument vector without node/script entries
 * @returns {{lang?: string, invalidLanguage?: string}} one value or a localized-error sentinel
 */
export function parseLanguageArgument(argv) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--lang") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) return { invalidLanguage: "--lang" };
      values.push(value);
      index += 1;
    } else if (argument.startsWith("--lang=")) {
      const value = argument.slice("--lang=".length);
      if (!value) return { invalidLanguage: "--lang" };
      values.push(value);
    }
  }
  return values.length > 1 ? { invalidLanguage: "--lang specified more than once" } : { lang: values[0] };
}

/**
 * Resolve strict explicit CLI language input and normalize only system hints.
 * @param {{lang?: string, invalidLanguage?: string, env?: NodeJS.ProcessEnv, getSystemLocale?: () => string}} options raw CLI inputs
 * @returns {CliLanguage} selected Locale and provenance
 * @throws {CliLanguageError} when an explicit flag or environment value is invalid
 */
export function resolveCliLanguage({ lang, invalidLanguage, env = process.env, getSystemLocale = () => Intl.DateTimeFormat().resolvedOptions().locale } = {}) {
  const system = systemLanguage(getSystemLocale);
  const environment = env?.MDXV_LANG;
  if (invalidLanguage !== undefined) {
    const errorLocale = isLocale(environment) ? environment : system.locale;
    if (invalidLanguage === "--lang") throw new CliOptionValueError("--lang", errorLocale);
    throw new CliLanguageError(invalidLanguage, errorLocale);
  }
  if (lang !== undefined) {
    if (isLocale(lang)) return { locale: lang, source: "argument" };
    const errorLocale = isLocale(environment) ? environment : system.locale;
    throw new CliLanguageError(lang, errorLocale);
  }
  if (environment !== undefined) {
    if (isLocale(environment)) return { locale: environment, source: "environment" };
    throw new CliLanguageError(environment, system.locale);
  }
  return system;
}

/**
 * Parse raw arguments and resolve the selected Locale in one shared CLI boundary.
 * @param {{argv: string[], env?: NodeJS.ProcessEnv, getSystemLocale?: () => string}} options process inputs
 * @returns {CliLanguage} selected Locale and provenance
 * @throws {CliLanguageError} for malformed, duplicate, or unsupported language input
 */
export function resolveCliArguments({ argv, env, getSystemLocale } = {}) {
  return resolveCliLanguage({ ...parseLanguageArgument(argv ?? []), env, getSystemLocale });
}

/**
 * Render an expected CLI input error through the selected product locale.
 * @param {{code?: string, params?: Record<string, unknown>, message?: string} | unknown} error expected CLI failure
 * @param {"zh-CN" | "en-US"} locale selected product Locale
 * @returns {string} localized, user-facing diagnostic
 */
export function formatCliError(error, locale) {
  const keys = {
    INVALID_LANGUAGE: "cli.invalidLanguage",
    OPTION_VALUE_MISSING: "cli.optionValueMissing",
    INPUT_REQUIRED: "cli.inputRequired",
    INPUT_NOT_FOUND: "cli.inputNotFound",
    INPUT_NOT_MDX: "cli.inputNotMdx",
    DIRECTORY_EMPTY: "cli.directoryEmpty",
    EXPORT_REQUIRES_FILE: "cli.exportRequiresFile",
    EXPORT_FAILED: "cli.exportFailed",
    CLI_ARGUMENTS: "cli.invalidArguments",
  };
  const key = keys[error?.code];
  return key ? t(locale, key, error.params) : String(error?.message || error);
}

/**
 * Convert an option-parser exception to a localized, stack-free diagnostics boundary.
 * @param {"zh-CN" | "en-US"} locale selected product Locale
 * @returns {string} localized parser diagnostic
 */
export function formatCliParserError(locale) {
  return t(locale, "cli.invalidArguments");
}
