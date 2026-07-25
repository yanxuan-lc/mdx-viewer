import { MESSAGES } from "./messages.mjs";

/** Supported product locales in their stable public order. @type {readonly ["zh-CN", "en-US"]} */
export const SUPPORTED_LOCALES = Object.freeze(["zh-CN", "en-US"]);

/** @param {unknown} value @returns {value is "zh-CN" | "en-US"} */
export function isLocale(value) {
  return SUPPORTED_LOCALES.includes(value);
}

/**
 * Normalize system/browser locale hints without accepting them as explicit CLI input.
 * @param {unknown} value system or browser locale identifier
 * @returns {"zh-CN" | "en-US"} product Locale
 */
export function normalizeSystemLocale(value) {
  if (typeof value !== "string") return "en-US";
  return /^zh-(cn|sg)(?:-|$)|^zh-hans(?:-|$)/i.test(value) ? "zh-CN" : "en-US";
}

/**
 * Look up a product message and replace named placeholders as text.
 * @param {"zh-CN" | "en-US"} locale selected product Locale
 * @param {string} key catalog key
 * @param {Record<string, unknown>} [values] interpolation values
 * @returns {string} localized plain-text message
 * @throws {Error} when a catalog key is missing
 */
export function t(locale, key, values = {}) {
  const catalog = MESSAGES[isLocale(locale) ? locale : "en-US"];
  const template = catalog[key];
  if (typeof template !== "string") throw new Error(`Unknown message key: ${key}`);
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? ""));
}
