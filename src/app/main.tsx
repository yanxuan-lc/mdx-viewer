/* ============================================================
   mdx-viewer · 浏览器入口
   —— 依 virtual:mdxv-config 决定加载单篇（虚拟 target）还是目录中的某篇（/@fs）。
      目录模式下拉取文件树，作为 prop 交给 Layout 里的文件抽屉渲染。
   ============================================================ */
import React from "react";
import { createRoot } from "react-dom/client";
import { Inbox } from "lucide-react";
import "katex/dist/katex.min.css";
import "./styles/fonts.css";
import "./styles/theme.css";
import { Layout, type NavFile } from "./Layout";
import { applyDocumentPreferences, resolveInitialPreferences, usePreferences } from "./PreferencesProvider";
import { readPreference, resolveBrowserLocale } from "./preferences.mjs";
import { isLocale, t } from "../i18n/locale.mjs";
import { buildLocalizedNavigation, resolveCurrentDocument, selectLocalizedDocument } from "../cli/localized-docs.mjs";
// @ts-expect-error 虚拟模块由 mdxv 插件提供
import config from "virtual:mdxv-config";

/** 拉取目录文件树（供文件抽屉渲染）。 */
async function fetchTree(): Promise<NavFile[]> {
  const res = await fetch("/__mdxv/tree");
  return res.json();
}

/** 空状态：doc 为空 / 指向不存在的文档时的友好提示（替代红色报错）。 */
function EmptyState({ messageKey }: { messageKey: "empty.selectDoc" | "empty.directory" | "empty.notFound" }) {
  const { t } = usePreferences();
  return (
    <div className="mv-empty">
      <Inbox size={40} strokeWidth={1.5} />
      <p>{t(messageKey)}</p>
    </div>
  );
}

function savedLocale() {
  try {
    return readPreference(window.localStorage, "mv-locale", isLocale);
  } catch {
    return undefined;
  }
}

function resolvedInitialLocale() {
  return resolveBrowserLocale({
    savedLocale: savedLocale(),
    initialLocale: config.initialLocale,
    localeSource: config.localeSource,
    browserLanguages: navigator.languages,
    browserLanguage: navigator.language,
  });
}

function RenderError({ error, locale = resolvedInitialLocale() }: { error: unknown; locale?: "zh-CN" | "en-US" }) {
  return <pre className="mv-render-error">{t(locale, "error.render", { error: String(error) })}</pre>;
}

function bootstrapPreferences(frontmatter: Record<string, unknown> = {}, locale?: "zh-CN" | "en-US") {
  const resolvedPreferences = resolveInitialPreferences({
    initialLocale: config.initialLocale,
    localeSource: config.localeSource,
    frontmatterMode: frontmatter.mode,
  });
  const preferences = locale ? { ...resolvedPreferences, locale } : resolvedPreferences;
  applyDocumentPreferences(preferences);
  document.documentElement.dataset.palette = frontmatter.palette === "teal" || frontmatter.palette === "rose" || frontmatter.palette === "amber" || frontmatter.palette === "lime" ? frontmatter.palette : "indigo";
  if (frontmatter.density === "compact") document.documentElement.dataset.density = "compact";
  else delete document.documentElement.dataset.density;
  return preferences;
}

function replaceDocumentQuery(doc: string) {
  const url = new URL(location.href);
  url.searchParams.set("doc", doc);
  history.replaceState(null, "", url);
}

const appElement = document.getElementById("app")!;
const root = createRoot(appElement);

function renderLocalizedError(error: unknown, locale: "zh-CN" | "en-US") {
  bootstrapPreferences({}, locale);
  root.render(<RenderError error={error instanceof Error ? error.stack || error.message : error} locale={locale} />);
  console.error(error);
}

async function boot() {
  if (config.mode === "dir") {
    const requestedDoc = new URLSearchParams(location.search).get("doc") || config.firstDoc;
    const files = await fetchTree();
    const locale = resolvedInitialLocale();

    // doc 为空：目录无文档 / 未指定；doc 指向文件树外的路径：坏链接或已删除。
    // 两者都给空提示，而非红色报错；真正的编译错误（doc 有效但编译失败）仍抛给下方错误页。
    const renderEmpty = (messageKey: "empty.selectDoc" | "empty.directory" | "empty.notFound") => {
      const initialPreferences = bootstrapPreferences();
      return (
      root.render(
        <React.StrictMode>
          <Layout frontmatter={{ chrome: "off" }} dir currentDoc={undefined} navFiles={buildLocalizedNavigation(files, locale)} initialLocale={config.initialLocale} localeSource={config.localeSource} initialPreferences={initialPreferences}>
            <EmptyState messageKey={messageKey} />
          </Layout>
        </React.StrictMode>
      ));
    };

    if (!requestedDoc) {
      renderEmpty(buildLocalizedNavigation(files, locale).length > 0 ? "empty.selectDoc" : "empty.directory");
      return;
    }
    if (!files.some((f) => f.abs === requestedDoc)) {
      renderEmpty("empty.notFound");
      return;
    }

    const renderDocument = async (physicalDoc: string, activeLocale: "zh-CN" | "en-US") => {
      const selectedDoc = resolveCurrentDocument(files, physicalDoc, activeLocale);
      if (!selectedDoc) return;
      let mod;
      try {
        mod = await import(/* @vite-ignore */ "/@fs" + selectedDoc.abs);
      } catch (error) {
        renderLocalizedError(error, activeLocale);
        return;
      }

      const Content = mod.default;
      const initialPreferences = bootstrapPreferences(mod.frontmatter, activeLocale);
      if (selectedDoc.abs !== new URLSearchParams(location.search).get("doc")) replaceDocumentQuery(selectedDoc.abs);
      root.render(
        <React.StrictMode>
        <Layout key={`${selectedDoc.abs}:${activeLocale}`} frontmatter={mod.frontmatter} dir currentDoc={selectedDoc.abs} navFiles={buildLocalizedNavigation(files, activeLocale)} initialLocale={config.initialLocale} localeSource={config.localeSource} initialPreferences={initialPreferences}
          onLocaleChange={(nextLocale) => {
            void renderDocument(selectedDoc.abs, nextLocale).catch((error) => renderLocalizedError(error, nextLocale));
          }}
          localizeDocument={(target) => selectLocalizedDocument(files, target, activeLocale)?.abs}>
            <Content />
          </Layout>
        </React.StrictMode>,
      );
    };

    await renderDocument(requestedDoc, locale);
    return;
  }

  // @ts-expect-error 虚拟模块
  const mod = await import("virtual:mdx-target");
  const Content = mod.default;
  const initialPreferences = bootstrapPreferences(mod.frontmatter);
  root.render(
    <React.StrictMode>
      {/* 单篇模式 config.firstDoc 即目标文件路径，供顶栏文件名兜底 */}
      <Layout frontmatter={mod.frontmatter} dir={false} currentDoc={config.firstDoc} initialLocale={config.initialLocale} localeSource={config.localeSource} initialPreferences={initialPreferences}>
        <Content />
      </Layout>
    </React.StrictMode>
  );
}

boot().catch((err) => {
  bootstrapPreferences();
  root.render(<RenderError error={err?.stack || err} locale={resolvedInitialLocale()} />);
  console.error(err);
});
