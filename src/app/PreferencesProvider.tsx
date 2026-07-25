import React from "react";
import { isLocale, t } from "../i18n/locale.mjs";
import {
  isThemePreference,
  nextThemePreference,
  readPreference,
  resolveBrowserLocale,
  resolveThemePreference,
  switchLocalePreference,
  writePreference,
} from "./preferences.mjs";

type Locale = "zh-CN" | "en-US";
type ThemePreference = "auto" | "light" | "dark";
type LocaleSource = "argument" | "environment" | "system" | "fallback";

export type InitialPreferences = {
  locale: Locale;
  themePreference: ThemePreference;
  systemDark: boolean;
};

type Preferences = {
  locale: Locale;
  themePreference: ThemePreference;
  theme: "light" | "dark";
  t: (key: string, values?: Record<string, unknown>) => string;
  toggleLocale: () => { locale: Locale; persisted: boolean };
  cycleTheme: () => void;
};

const PreferencesContext = React.createContext<Preferences | undefined>(undefined);

function prefersDark() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function resolvedTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  if (preference === "auto") return systemDark ? "dark" : "light";
  return preference;
}

/** Apply an already-resolved preference before React mounts or after a committed update. */
export function applyDocumentPreferences({ locale, themePreference, systemDark }: InitialPreferences) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.themePreference = themePreference;
  document.documentElement.dataset.theme = resolvedTheme(themePreference, systemDark);
}

/** Resolve browser state once for bootstrap and the Provider's initial state. */
export function resolveInitialPreferences({ initialLocale = "en-US", localeSource = "fallback", frontmatterMode }: {
  initialLocale?: Locale;
  localeSource?: LocaleSource;
  frontmatterMode?: unknown;
} = {}): InitialPreferences {
  const storage = browserStorage();
  return {
    locale: resolveBrowserLocale({
      savedLocale: readPreference(storage, "mv-locale", isLocale),
      initialLocale,
      localeSource,
      browserLanguages: typeof navigator === "undefined" ? undefined : navigator.languages,
      browserLanguage: typeof navigator === "undefined" ? undefined : navigator.language,
    }),
    themePreference: resolveThemePreference({
      savedTheme: readPreference(storage, "mv-theme", isThemePreference),
      frontmatterMode,
    }),
    systemDark: prefersDark(),
  };
}

/** Holds product locale and theme preference without touching author-provided MDX content. */
export function PreferencesProvider({
  initialLocale = "en-US",
  localeSource = "fallback",
  frontmatterMode,
  initialPreferences,
  children,
}: React.PropsWithChildren<{
  initialLocale?: Locale;
  localeSource?: LocaleSource;
  frontmatterMode?: unknown;
  initialPreferences?: InitialPreferences;
}>) {
  const storage = browserStorage();
  const [startup] = React.useState<InitialPreferences>(() => initialPreferences ?? resolveInitialPreferences({ initialLocale, localeSource, frontmatterMode }));
  const [locale, setLocale] = React.useState<Locale>(startup.locale);
  const [themePreference, setThemePreference] = React.useState<ThemePreference>(startup.themePreference);
  const [systemDark, setSystemDark] = React.useState(startup.systemDark);
  const theme = resolvedTheme(themePreference, systemDark);

  React.useLayoutEffect(() => {
    applyDocumentPreferences({ locale, themePreference, systemDark });
  }, [locale, systemDark, themePreference]);

  React.useEffect(() => {
    if (themePreference !== "auto" || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [themePreference]);

  React.useEffect(() => {
    (globalThis as any).__mmdRender?.();
  }, [theme]);

  const value = React.useMemo<Preferences>(() => ({
    locale,
    themePreference,
    theme,
    t: (key, values) => t(locale, key, values),
    toggleLocale: () => {
      const result = switchLocalePreference(locale, storage);
      setLocale(result.locale);
      return result;
    },
    cycleTheme: () => {
      const next = nextThemePreference(themePreference);
      if (next === "auto") setSystemDark(prefersDark());
      setThemePreference(next);
      writePreference(storage, "mv-theme", next, isThemePreference);
    },
  }), [locale, storage, theme, themePreference]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

/** Access product-owned locale, messages, and preference controls. */
export function usePreferences() {
  const preferences = React.useContext(PreferencesContext);
  if (!preferences) throw new Error("usePreferences must be used inside PreferencesProvider");
  return preferences;
}
