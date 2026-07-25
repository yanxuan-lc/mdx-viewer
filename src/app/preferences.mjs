import { isLocale, normalizeSystemLocale } from "../i18n/locale.mjs";

export const THEME_PREFERENCES = Object.freeze(["auto", "light", "dark"]);

/** @param {unknown} value @returns {value is "auto" | "light" | "dark"} */
export function isThemePreference(value) {
  return THEME_PREFERENCES.includes(value);
}

/**
 * Safely read and validate a raw browser storage preference.
 * @param {{getItem?: (key: string) => string | null} | undefined} storage storage boundary
 * @param {string} key preference key
 * @param {(value: unknown) => boolean} validate exact value validator
 * @returns {string | undefined} valid raw value, if available
 */
export function readPreference(storage, key, validate) {
  try {
    const value = storage?.getItem(key);
    return validate(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Safely write a valid raw browser storage preference.
 * @param {{setItem?: (key: string, value: string) => void} | undefined} storage storage boundary
 * @param {string} key preference key
 * @param {string} value raw value to write
 * @param {(value: unknown) => boolean} validate exact value validator
 * @returns {boolean} true only when a valid value was passed to an available storage writer
 */
export function writePreference(storage, key, value, validate) {
  if (!storage?.setItem || !validate(value)) return false;
  try {
    storage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Switch the product locale and report whether its browser preference was persisted.
 * @param {"zh-CN" | "en-US"} locale current product locale
 * @param {{setItem?: (key: string, value: string) => void} | undefined} storage browser storage boundary
 * @returns {{locale: "zh-CN" | "en-US", persisted: boolean}} next locale and persistence result
 */
export function switchLocalePreference(locale, storage) {
  const nextLocale = locale === "zh-CN" ? "en-US" : "zh-CN";
  return {
    locale: nextLocale,
    persisted: writePreference(storage, "mv-locale", nextLocale, isLocale),
  };
}

/**
 * Resolve browser locale according to saved, injected, browser, and system precedence.
 * @param {{savedLocale?: unknown, initialLocale?: unknown, localeSource?: string, browserLanguages?: string[], browserLanguage?: string}} options input hints
 * @returns {"zh-CN" | "en-US"} resolved product Locale
 */
export function resolveBrowserLocale({ savedLocale, initialLocale, localeSource, browserLanguages, browserLanguage } = {}) {
  if (isLocale(savedLocale)) return savedLocale;
  if ((localeSource === "argument" || localeSource === "environment") && isLocale(initialLocale)) return initialLocale;
  const primaryLanguage = Array.isArray(browserLanguages) && browserLanguages.length > 0
    ? browserLanguages[0]
    : browserLanguage;
  if (primaryLanguage) return normalizeSystemLocale(primaryLanguage);
  if ((localeSource === "system" || localeSource === "fallback") && isLocale(initialLocale)) return initialLocale;
  return "en-US";
}

/**
 * Resolve saved theme before exact frontmatter mode, falling back to auto.
 * @param {{savedTheme?: unknown, frontmatterMode?: unknown}} options raw preference hints
 * @returns {"auto" | "light" | "dark"} resolved preference
 */
export function resolveThemePreference({ savedTheme, frontmatterMode } = {}) {
  if (isThemePreference(savedTheme)) return savedTheme;
  return isThemePreference(frontmatterMode) ? frontmatterMode : "auto";
}

/** @param {unknown} preference current preference @returns {"auto" | "light" | "dark"} next toolbar preference */
export function nextThemePreference(preference) {
  const index = THEME_PREFERENCES.indexOf(preference);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length];
}
