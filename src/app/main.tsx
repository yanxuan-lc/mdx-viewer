/* ============================================================
   mdx-viewer · 浏览器入口
   —— 依 virtual:mdxv-config 决定加载单篇（虚拟 target）还是目录中的某篇（/@fs）。
      目录模式下拉取文件树，作为 prop 交给 Layout 里的文件抽屉渲染；
      server 端监听到文档增删会推 "mdxv:tree"，收到后重取文件树并重画。
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

/** server 端在文档增删后推的自定义 HMR 事件（发送方见 src/cli/plugin.mjs）。 */
const TREE_EVENT = "mdxv:tree";

/** 拉取目录文件树（供文件抽屉渲染）；dev 下 server 每次都现扫磁盘。 */
async function fetchTree(): Promise<NavFile[]> {
  const res = await fetch("/__mdxv/tree");
  return res.json();
}

type EmptyMessageKey = "empty.selectDoc" | "empty.directory" | "empty.notFound";

/** 空状态：doc 为空 / 指向不存在的文档时的友好提示（替代红色报错）。 */
function EmptyState({ messageKey }: { messageKey: EmptyMessageKey }) {
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

/** 当前视图。文档变体保留已加载的 module，好让「文件树变了」只重画抽屉。 */
type View =
  | { kind: "empty"; messageKey: EmptyMessageKey; preferences: ReturnType<typeof bootstrapPreferences> }
  | { kind: "doc"; abs: string; locale: "zh-CN" | "en-US"; module: any; preferences: ReturnType<typeof bootstrapPreferences> };

async function boot() {
  if (config.mode === "dir") {
    const requestedDoc = new URLSearchParams(location.search).get("doc") || config.firstDoc;
    const locale = resolvedInitialLocale();
    let files = await fetchTree();
    let view: View;

    /** 用当前 view + 最新 files 重画。不重新 import、不重跑 bootstrapPreferences。 */
    const paint = () => {
      const current = view;
      if (current.kind === "empty") {
        // doc 为空：目录无文档 / 未指定；doc 指向文件树外的路径：坏链接或已删除。
        // 两者都给空提示，而非红色报错；真正的编译错误（doc 有效但编译失败）仍走错误页。
        root.render(
          <React.StrictMode>
            <Layout frontmatter={{ chrome: "off" }} dir currentDoc={undefined} navFiles={buildLocalizedNavigation(files, locale)} initialLocale={config.initialLocale} localeSource={config.localeSource} initialPreferences={current.preferences}>
              <EmptyState messageKey={current.messageKey} />
            </Layout>
          </React.StrictMode>
        );
        return;
      }
      const Content = current.module.default;
      root.render(
        <React.StrictMode>
        <Layout key={`${current.abs}:${current.locale}`} frontmatter={current.module.frontmatter} dir currentDoc={current.abs} navFiles={buildLocalizedNavigation(files, current.locale)} initialLocale={config.initialLocale} localeSource={config.localeSource} initialPreferences={current.preferences}
          onLocaleChange={(nextLocale) => {
            void openDocument(current.abs, nextLocale).catch((error) => renderLocalizedError(error, nextLocale));
          }}
          localizeDocument={(target) => selectLocalizedDocument(files, target, current.locale)?.abs}>
            <Content />
          </Layout>
        </React.StrictMode>,
      );
    };

    const showEmpty = (messageKey: EmptyMessageKey) => {
      view = { kind: "empty", messageKey, preferences: bootstrapPreferences() };
      paint();
    };

    const openDocument = async (physicalDoc: string, activeLocale: "zh-CN" | "en-US") => {
      const selectedDoc = resolveCurrentDocument(files, physicalDoc, activeLocale);
      if (!selectedDoc) return;
      let mod;
      try {
        mod = await import(/* @vite-ignore */ "/@fs" + selectedDoc.abs);
      } catch (error) {
        renderLocalizedError(error, activeLocale);
        return;
      }
      const preferences = bootstrapPreferences(mod.frontmatter, activeLocale);
      if (selectedDoc.abs !== new URLSearchParams(location.search).get("doc")) replaceDocumentQuery(selectedDoc.abs);
      view = { kind: "doc", abs: selectedDoc.abs, locale: activeLocale, module: mod, preferences };
      paint();
    };

    // 文件树变了：重取列表，再决定是只刷新抽屉还是换视图。
    const refreshTree = async () => {
      files = await fetchTree();
      const current = view;
      if (current.kind === "doc") {
        // 当前这篇被删了就落到 notFound，而不是继续展示一份已经不存在的文档。
        if (files.some((file) => file.abs === current.abs)) paint();
        else showEmpty("empty.notFound");
        return;
      }
      // 之前是空状态：请求的那篇刚被创建出来就直接打开，否则按新的树重算提示文案。
      if (requestedDoc && files.some((file) => file.abs === requestedDoc)) {
        await openDocument(requestedDoc, locale);
        return;
      }
      showEmpty(requestedDoc ? "empty.notFound" : buildLocalizedNavigation(files, locale).length > 0 ? "empty.selectDoc" : "empty.directory");
    };

    if (!requestedDoc) showEmpty(buildLocalizedNavigation(files, locale).length > 0 ? "empty.selectDoc" : "empty.directory");
    else if (!files.some((file) => file.abs === requestedDoc)) showEmpty("empty.notFound");
    else await openDocument(requestedDoc, locale);

    import.meta.hot?.on(TREE_EVENT, () => {
      void refreshTree().catch((error) => renderLocalizedError(error, locale));
    });
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
