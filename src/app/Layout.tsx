/* ============================================================
   mdx-viewer · Layout —— 标准模板骨架
   frontmatter 驱动：主题 / 配色 / 自动 Hero / TOC / 落款。
   ============================================================ */
import React from "react";
import { Sun, Moon, Monitor, Menu, X, ChevronRight } from "lucide-react";
import { MDXProvider } from "@mdx-js/react";
import { mdxComponents } from "./mdx-components";
import { Hero, resetSectionIds } from "./components/blocks";
import { Footer, Colophon } from "./components/client";
import { PreferencesProvider, usePreferences, type InitialPreferences } from "./PreferencesProvider";
import { buildLocalizedDocumentUrl, resolveLocalDocumentLink } from "./local-document-links.mjs";

type FM = Record<string, any>;

export type NavFile = { rel: string; abs: string; dir: string; familyRel?: string; locale?: "zh-CN" | "en-US" };

const COLLAPSE_KEY = "mv-nav-collapsed";
const NAV_OPEN_KEY = "mv-nav-open"; // 抽屉开关：sessionStorage 记忆，跨切文件的整页刷新保留

/** 顶栏标题：frontmatter.title 优先，缺失时用文件名（去扩展名）兜底。 */
function docTitle(fm: FM, currentDoc?: string): string {
  if (fm.title) return String(fm.title);
  if (!currentDoc) return "";
  return currentDoc.slice(currentDoc.lastIndexOf("/") + 1).replace(/\.mdx?$/i, "");
}

/** 文件抽屉：菜单按钮触发，从左滑入的悬浮浮层。目录分组可折叠、状态持久化。 */
function NavDrawer({ files, currentDoc, open, onClose }: {
  files: NavFile[]; currentDoc?: string; open: boolean; onClose: () => void;
}) {
  const { t } = usePreferences();
  const drawerRef = React.useRef<HTMLElement>(null);
  React.useLayoutEffect(() => {
    drawerRef.current?.toggleAttribute("inert", !open);
  }, [open]);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => {
    try { const v = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "[]"); return new Set(Array.isArray(v) ? v : []); }
    catch { return new Set(); }
  });
  const setGroup = (dir: string, isOpen: boolean) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(dir); else next.add(dir);
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])); } catch { /* unavailable storage is non-blocking */ }
      return next;
    });

  const byDir: Record<string, NavFile[]> = {};
  for (const f of files) (byDir[f.dir] ||= []).push(f);

  const link = (f: NavFile, dir: string) => {
    const url = new URL(location.href);
    url.searchParams.set("doc", f.abs);
    const raw = f.rel.replace(/\.mdx?$/i, "");
    const label = dir ? raw.slice(dir.length + 1) : raw; // 分组内只显示相对该目录的名字
    return (
      <a key={f.abs} className={f.abs === currentDoc ? "active" : ""}
        href={`${url.pathname}${url.search}`} onClick={onClose}>{label}</a>
    );
  };

  return (
    <>
      <div className={`mv-nav-backdrop${open ? " open" : ""}`} onClick={onClose} />
      <aside ref={drawerRef} className={`mv-nav-drawer${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="mv-nav-head">
          <span>{t("nav.files")}</span>
          <button className="mv-nav-close" onClick={onClose} aria-label={t("nav.close")} title={t("nav.close")}><X size={16} /></button>
        </div>
        <nav className="mv-nav">
          {Object.entries(byDir).map(([dir, list]) =>
            !dir ? (
              <div className="mv-navroot" key="__root">{list.map((f) => link(f, dir))}</div>
            ) : (
              <details className="mv-navgroup" key={dir} open={!collapsed.has(dir)}
                onToggle={(e) => setGroup(dir, e.currentTarget.open)}>
                <summary><ChevronRight className="chev" size={14} /><span>{dir}</span></summary>
                <div className="mv-navgroup-body">{list.map((f) => link(f, dir))}</div>
              </details>
            )
          )}
        </nav>
      </aside>
    </>
  );
}


/** mermaid：客户端渲染 pre.mermaid，随明暗重渲。 */
function useMermaid(deps: any) {
  React.useEffect(() => {
    if (!document.querySelector("pre.mermaid")) return;
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      if (cancelled) return;
      const cs = getComputedStyle(document.documentElement);
      const g = (n: string) => cs.getPropertyValue(n).trim();
      const render = () => {
        document.querySelectorAll<HTMLElement>("pre.mermaid").forEach((el) => {
          if (el.dataset.src === undefined) el.dataset.src = el.textContent || "";
          el.removeAttribute("data-processed");
          el.innerHTML = el.dataset.src!;
        });
        mermaid.initialize({
          startOnLoad: false, securityLevel: "loose", fontFamily: "inherit", theme: "base",
          themeVariables: {
            background: "transparent", primaryColor: g("--surface-2"), primaryTextColor: g("--ink"),
            primaryBorderColor: g("--border"), lineColor: g("--muted"), textColor: g("--ink"),
            mainBkg: g("--surface-2"), nodeBorder: g("--border"), clusterBkg: "transparent",
            clusterBorder: g("--border"), actorBkg: g("--surface-2"), actorBorder: g("--accent"),
            signalColor: g("--muted"), signalTextColor: g("--ink"), noteBkgColor: g("--muted-bg"), noteTextColor: g("--ink"),
          },
        });
        mermaid.run({ querySelector: "pre.mermaid" });
      };
      render();
      (globalThis as any).__mmdRender = render;
    })();
    return () => { cancelled = true; };
  }, [deps]);
}

/** 内容滚动进场：给 .mv-md 顶层块加初始态，进入视口再淡入上移。 */
function useScrollReveal(dep: any) {
  React.useLayoutEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.querySelector(".mv-md");
    if (!root) return;
    const targets = Array.from(root.children) as HTMLElement[];
    targets.forEach((el) => el.classList.add("mv-reveal"));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("mv-in"); io.unobserve(e.target); }
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [dep]);
}

/** dir 模式：正文里指向本地 .md/.mdx 的相对链接改写为 ?doc= 内部跳转。 */
function useLocalLinkRouting(enabled: boolean, currentDoc?: string, localizeDocument?: (document: string) => string | undefined) {
  React.useEffect(() => {
    if (!enabled) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      // 只路由正文内的相对链接；侧边栏 / TOC 等 chrome 链接不拦截，
      // 否则以 .mdx 结尾的 ?doc= 导航会被误判为相对链接而跳错。
      if (!a.closest(".mv-md")) return;
      const href = a.getAttribute("href") || "";
      if (/^(https?:|#|mailto:)/.test(href)) return;
      if (!/\.mdx?($|[?#])/.test(href)) return;
      const target = resolveLocalDocumentLink(currentDoc, href);
      if (!target) return;
      const localized = localizeDocument?.(target.document);
      if (localizeDocument && !localized) return;
      e.preventDefault();
      location.href = buildLocalizedDocumentUrl(location.href, localized ?? target.document, target.search, target.hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [enabled, currentDoc, localizeDocument]);
}

function ThemeToggle() {
  const { cycleTheme, t, themePreference } = usePreferences();
  const next = themePreference === "auto" ? "light" : themePreference === "light" ? "dark" : "auto";
  const Icon = themePreference === "auto" ? Monitor : themePreference === "dark" ? Moon : Sun;
  const label = t("control.theme", { theme: t(`theme.${next}`) });
  return (
    <button className="mv-theme-toggle" onClick={cycleTheme} aria-label={label} title={label}>
      <Icon size={16} />
    </button>
  );
}

function LanguageToggle({ onLocaleChange }: { onLocaleChange?: (locale: "zh-CN" | "en-US") => void }) {
  const { locale, toggleLocale, t } = usePreferences();
  const label = t("control.language");
  const switchLocale = () => {
    const { locale: nextLocale } = toggleLocale();
    onLocaleChange?.(nextLocale);
  };
  return <button className="mv-language-toggle" onClick={switchLocale} aria-label={label} title={label}>{locale === "zh-CN" ? "EN" : "中"}</button>;
}

function Topbar({ hasNav, drawerOpen, onToggle, title, onLocaleChange }: { hasNav: boolean; drawerOpen: boolean; onToggle: () => void; title: string; onLocaleChange?: (locale: "zh-CN" | "en-US") => void }) {
  const { t } = usePreferences();
  return (
    <div className="mv-topbar">
      <div className="tb-left">
        {hasNav && <button className="mv-menu-btn" onClick={onToggle} aria-label={t("nav.menu")} title={t("nav.menu")} aria-expanded={drawerOpen}><Menu size={18} /></button>}
        <div className="tb-title">{title}</div>
      </div>
      <div className="tb-right"><LanguageToggle onLocaleChange={onLocaleChange} /><ThemeToggle /></div>
    </div>
  );
}

function Toc({ dep }: { dep?: any }) {
  const { t } = usePreferences();
  const [items, setItems] = React.useState<{ id: string; title: string }[]>([]);
  const [active, setActive] = React.useState("");
  React.useEffect(() => {
    const secs = Array.from(document.querySelectorAll<HTMLElement>("[data-mv-section]"));
    setItems(secs.map((s) => ({ id: s.id, title: s.getAttribute("title") || "" })));
  }, [dep]);
  // 滚动高亮当前分节
  React.useEffect(() => {
    if (!items.length) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive((e.target as HTMLElement).id); }),
      { rootMargin: "-68px 0px -70% 0px", threshold: 0 },
    );
    items.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [items]);
  if (!items.length) return null;
  return (
    <nav className="mv-toc">
      <div className="tl">{t("toc.title")}</div>
      {items.map((s) => (
        <a key={s.id} href={`#${s.id}`} className={s.id === active ? "active" : ""}
          onClick={() => setActive(s.id)}>{s.title}</a>
      ))}
    </nav>
  );
}

export function Layout({ frontmatter = {}, children, dir, currentDoc, navFiles = [], initialLocale, localeSource, initialPreferences, onLocaleChange, localizeDocument }: React.PropsWithChildren<{ frontmatter?: FM; dir?: boolean; currentDoc?: string; navFiles?: NavFile[]; initialLocale?: "zh-CN" | "en-US"; localeSource?: "argument" | "environment" | "system" | "fallback"; initialPreferences?: InitialPreferences; onLocaleChange?: (locale: "zh-CN" | "en-US") => void; localizeDocument?: (document: string) => string | undefined }>) {
  const fm = frontmatter || {};
  React.useLayoutEffect(() => {
    document.documentElement.dataset.palette = fm.palette || "indigo";
    if (fm.density === "compact") document.documentElement.dataset.density = "compact";
    else delete document.documentElement.dataset.density;
  }, [fm.density, fm.palette]);
  useMermaid([currentDoc]);
  useScrollReveal(currentDoc);
  useLocalLinkRouting(!!dir, currentDoc, localizeDocument);
  resetSectionIds();

  const hasNav = navFiles.length > 1;
  const [navOpen, setNavOpen] = React.useState(() => {
    try { return sessionStorage.getItem(NAV_OPEN_KEY) === "1"; } catch { return false; }
  });
  const drawerOpen = hasNav && navOpen; // 单篇无抽屉时不生效
  // 记忆开关（切文件是整页刷新，靠这个跨刷新保留抽屉状态）
  React.useEffect(() => {
    try { sessionStorage.setItem(NAV_OPEN_KEY, navOpen ? "1" : "0"); } catch { /* ignore */ }
  }, [navOpen]);
  // 打开时锁背景滚动 + Esc 关闭
  React.useEffect(() => {
    document.body.classList.toggle("mv-nav-locked", drawerOpen);
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setNavOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const title = docTitle(fm, currentDoc);

  const chromeOff = fm.chrome === "off";
  const showAutoHero = !chromeOff && fm.title && fm.hero !== false;

  return (
    <PreferencesProvider initialLocale={initialLocale} localeSource={localeSource} frontmatterMode={fm.mode} initialPreferences={initialPreferences}>
    <MDXProvider components={mdxComponents}>
      <Topbar hasNav={hasNav} drawerOpen={drawerOpen} onToggle={() => setNavOpen((value) => !value)} title={title} onLocaleChange={onLocaleChange} />
      {hasNav && (
        <NavDrawer files={navFiles} currentDoc={currentDoc} open={drawerOpen} onClose={() => {
          try { sessionStorage.setItem(NAV_OPEN_KEY, "0"); } catch { /* unavailable storage is non-blocking */ }
          setNavOpen(false);
        }} />
      )}
      {showAutoHero && (
        <Hero eyebrow={fm.eyebrow} title={fm.title} sub={fm.subtitle}
          date={[fm.datetime, fm.org].filter(Boolean).join(" · ") || undefined} />
      )}
      <main className="mv-doc">
        <div className="mv-md">{children}</div>
      </main>
      {fm.toc === true && <Toc dep={currentDoc} />}
      {!chromeOff && (
        <div className="mv-footwrap">
          {fm.footer && <Footer>{fm.footer}</Footer>}
          <Colophon author={fm.author} datetime={fm.datetime} copyright={fm.copyright} />
        </div>
      )}
    </MDXProvider>
    </PreferencesProvider>
  );
}
