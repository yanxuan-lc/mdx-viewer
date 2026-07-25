import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTED_LOCALES,
  isLocale,
  normalizeSystemLocale,
  t,
} from "../src/i18n/locale.mjs";
import { MESSAGES } from "../src/i18n/messages.mjs";
import {
  readPreference,
  nextThemePreference,
  resolveBrowserLocale,
  resolveThemePreference,
  switchLocalePreference,
  writePreference,
} from "../src/app/preferences.mjs";

test("S1/S2: system locale maps only Simplified Chinese variants to zh-CN", () => {
  for (const value of ["zh-CN", "zh-SG", "zh-Hans", "zh-Hans-CN"]) {
    assert.equal(normalizeSystemLocale(value), "zh-CN", value);
  }
  for (const value of ["en-US", "fr-FR", "zh-TW", "zh-Hant-HK", undefined]) {
    assert.equal(normalizeSystemLocale(value), "en-US", String(value));
  }
});

test("public locale values use full BCP 47 tags", () => {
  assert.equal(isLocale("en-US"), true);
  assert.equal(isLocale("en"), false);
});

test("S1/S2: browser locale honors storage, explicit CLI, browser, then system", () => {
  assert.equal(resolveBrowserLocale({ savedLocale: "en-US", initialLocale: "zh-CN", localeSource: "argument", browserLanguages: ["zh-CN"] }), "en-US");
  assert.equal(resolveBrowserLocale({ initialLocale: "en-US", localeSource: "environment", browserLanguages: ["zh-CN"] }), "en-US");
  assert.equal(resolveBrowserLocale({ initialLocale: "en-US", localeSource: "system", browserLanguages: ["zh-CN"] }), "zh-CN");
  assert.equal(resolveBrowserLocale({ initialLocale: "zh-CN", localeSource: "system", browserLanguages: ["zh-TW"] }), "en-US");
  assert.equal(resolveBrowserLocale({ initialLocale: "zh-CN", localeSource: "system" }), "zh-CN");
});

test("S6/S7: theme preference accepts exact storage and frontmatter values only", () => {
  assert.equal(resolveThemePreference({ savedTheme: "dark", frontmatterMode: "light" }), "dark");
  assert.equal(resolveThemePreference({ savedTheme: "broken", frontmatterMode: "light" }), "light");
  assert.equal(resolveThemePreference({ frontmatterMode: "auto" }), "auto");
  assert.equal(resolveThemePreference({ frontmatterMode: "DARK" }), "auto");
  assert.equal(resolveThemePreference({}), "auto");
});

test("S4: theme toolbar has a stable three-state cycle", () => {
  assert.equal(nextThemePreference("auto"), "light");
  assert.equal(nextThemePreference("light"), "dark");
  assert.equal(nextThemePreference("dark"), "auto");
});

test("S7: unavailable storage and invalid saved values safely fall back without rewriting", () => {
  const throwing = { getItem() { throw new Error("disabled"); }, setItem() { throw new Error("disabled"); } };
  assert.equal(readPreference(throwing, "mv-locale", isLocale), undefined);
  assert.equal(writePreference(throwing, "mv-locale", "en-US", isLocale), false);
  assert.equal(writePreference(undefined, "mv-locale", "en-US", isLocale), false);
  assert.equal(resolveBrowserLocale({ savedLocale: readPreference(throwing, "mv-locale", isLocale), browserLanguage: "zh-CN" }), "zh-CN");
});

test("S7: language selection reports persistence failure so callers can retain the in-memory locale", () => {
  const writes = [];
  const writable = { setItem: (key, value) => writes.push([key, value]) };
  assert.deepEqual(switchLocalePreference("en-US", writable), { locale: "zh-CN", persisted: true });
  assert.deepEqual(writes, [["mv-locale", "zh-CN"]]);

  const unavailable = { setItem: () => { throw new Error("storage disabled"); } };
  assert.deepEqual(switchLocalePreference("zh-CN", unavailable), { locale: "en-US", persisted: false });
});

test("S8: both message catalogs have the same complete key set and interpolate plain text", () => {
  assert.deepEqual(Object.keys(MESSAGES["zh-CN"]).sort(), Object.keys(MESSAGES["en-US"]).sort());
  assert.equal(t("en-US", "cli.invalidLanguage", { value: "<script>", allowed: "zh-CN or en-US" }), 'Unsupported language "<script>"; expected zh-CN or en-US.');
  assert.equal(t("en-US", "empty.notFound"), "Document not found. Choose one again from the menu.");
  assert.equal(t("zh-CN", "empty.notFound"), "找不到该文档，请从菜单重新选择");
  assert.throws(() => t("en-US", "missing.key"), /Unknown message key/);
  assert.deepEqual(SUPPORTED_LOCALES, ["zh-CN", "en-US"]);
});
