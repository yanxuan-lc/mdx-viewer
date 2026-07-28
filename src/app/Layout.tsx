/* ============================================================
   mdx-viewer · Layout —— 标准模板骨架
   frontmatter 驱动：主题 / 配色 / 自动 Hero / TOC / 落款。
   ============================================================ */
import React from "react";
import { Sun, Moon, Monitor, Menu, X, ChevronRight, Plus, Minus, Maximize2 } from "lucide-react";
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

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 8;
const clampZoom = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
// 注入到每个 .mv-diagram 的放大按钮图标（DOM 直接创建，用不了 lucide React 组件，内联 maximize-2）。
const MAXIMIZE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

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

/**
 * 图表全屏预览：给每个 .mv-diagram 注入放大按钮，点击后在全屏遮罩里展示该图的 SVG，
 * 支持滚轮缩放（以光标为锚点）、拖拽平移、工具栏 +/−/适应窗口、Esc / 点空白 / 关闭按钮退出。
 * 图在编译期是静态 HTML（mermaid 客户端渲染后内部才成 SVG），故按钮挂在 wrapper 上，
 * SVG 在点击那一刻现取，天然规避 mermaid 的异步时序。
 */
function DiagramZoom({ dep }: { dep: any }) {
  const { t } = usePreferences();
  const [source, setSource] = React.useState<SVGSVGElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const view = React.useRef({ scale: 1, tx: 0, ty: 0 });
  const nat = React.useRef({ w: 0, h: 0 }); // 图的自然尺寸（取自 viewBox）

  // 幂等注入放大按钮；文档或语言变化时补建 / 刷新无障碍标签。
  React.useEffect(() => {
    const label = t("diagram.zoom");
    document.querySelectorAll<HTMLElement>(".mv-diagram").forEach((d) => {
      let btn = d.querySelector<HTMLButtonElement>(":scope > .mv-zoom-btn");
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mv-zoom-btn";
        btn.innerHTML = MAXIMIZE_ICON;
        d.appendChild(btn);
      }
      btn.setAttribute("aria-label", label);
      btn.title = label;
    });
  }, [dep, t]);

  // 委托点击：命中任一放大按钮 → 取所在图的 SVG 打开遮罩。
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest?.(".mv-zoom-btn");
      if (!btn) return;
      const diagram = btn.closest(".mv-diagram");
      // 排除按钮自身的图标 <svg>，取图的真身。
      const svg = diagram && [...diagram.querySelectorAll("svg")].find((s) => !s.closest(".mv-zoom-btn"));
      if (svg) setSource(svg as unknown as SVGSVGElement);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // 缩放靠给 SVG 设内在像素尺寸（矢量重渲，任意倍数都清晰），平移靠 translate（GPU 平滑）。
  const apply = React.useCallback(() => {
    const { scale, tx, ty } = view.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const svg = canvas.firstElementChild as SVGElement | null;
    if (svg) {
      svg.style.width = `${nat.current.w * scale}px`;
      svg.style.height = `${nat.current.h * scale}px`;
    }
    canvas.style.transform = `translate(${tx}px, ${ty}px)`;
  }, []);

  // 适应窗口：按自然尺寸算居中缩放，填满约 92% 视口——小图放大、大图缩小，都取「最合适」的尺寸。
  const fit = React.useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const { w, h } = nat.current;
    if (!w || !h) return;
    const s = stage.getBoundingClientRect();
    const scale = clampZoom(Math.min((s.width * 0.92) / w, (s.height * 0.92) / h));
    view.current = { scale, tx: (s.width - w * scale) / 2, ty: (s.height - h * scale) / 2 };
    apply();
  }, [apply]);

  // 以某个视口锚点为不动点缩放（滚轮用光标、按钮用中心）。
  const zoomAt = React.useCallback((factor: number, ax: number, ay: number) => {
    const v = view.current;
    const next = clampZoom(v.scale * factor);
    const k = next / v.scale;
    v.tx = ax - (ax - v.tx) * k;
    v.ty = ay - (ay - v.ty) * k;
    v.scale = next;
    apply();
  }, [apply]);

  const zoomByCenter = React.useCallback((factor: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    zoomAt(factor, r.width / 2, r.height / 2);
  }, [zoomAt]);

  // 打开时克隆 SVG、适应窗口、锁滚动，并绑定滚轮 / 拖拽（wheel 需非 passive 才能 preventDefault）。
  React.useLayoutEffect(() => {
    if (!source) return;
    const stage = stageRef.current, canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const clone = source.cloneNode(true) as SVGSVGElement;
    // 这里以前有一句 `clone.removeAttribute("style")`，已去掉：那时根 <svg> 上的 style 是图
    // 管线自己注入的（`max-width:100%;height:auto`），删掉没有代价；那条注入已移除，现在
    // 根上的 style 只可能是**作者写的**（`svg` 车道原样内联作者标记），整条删掉会让全屏里
    // 丢掉作者样式、与页内观感不一致。也不需要改写它：放大所需的尺寸由下面的 apply() 以
    // 内联 width/height 写入，`max-width` 由 `.mv-zoom-canvas svg` 的 !important 接管。
    // 自然尺寸优先取 viewBox（矢量、单位干净）；缺失时回退到实测。
    const vb = source.viewBox?.baseVal;
    if (vb && vb.width && vb.height) nat.current = { w: vb.width, h: vb.height };
    else { const r = source.getBoundingClientRect(); nat.current = { w: r.width || 1, h: r.height || 1 }; }
    canvas.replaceChildren(clone);
    fit();
    document.body.classList.add("mv-nav-locked");

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    let drag: { x: number; y: number; moved: boolean; onBg: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, moved: false, onBg: e.target === stage };
      try { stage.setPointerCapture(e.pointerId); } catch { /* 非活动指针（如合成事件） */ }
      stage.classList.add("mv-grabbing");
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      view.current.tx += dx;
      view.current.ty += dy;
      drag.x = e.clientX;
      drag.y = e.clientY;
      apply();
    };
    const onUp = (e: PointerEvent) => {
      const d = drag;
      drag = null;
      stage.classList.remove("mv-grabbing");
      try { stage.releasePointerCapture(e.pointerId); } catch { /* 已释放 */ }
      if (d && !d.moved && d.onBg) setSource(null); // 点击空白处关闭
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSource(null); };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    document.addEventListener("keydown", onKey);
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("mv-nav-locked");
    };
  }, [source, fit, apply, zoomAt]);

  if (!source) return null;
  return (
    <div className="mv-zoom-overlay" role="dialog" aria-modal="true" aria-label={t("diagram.zoom")}>
      <div className="mv-zoom-stage" ref={stageRef}>
        <div className="mv-zoom-canvas" ref={canvasRef} onDoubleClick={fit} />
      </div>
      <div className="mv-zoom-toolbar">
        <button onClick={() => zoomByCenter(1.25)} aria-label={t("diagram.zoomIn")} title={t("diagram.zoomIn")}><Plus size={16} /></button>
        <button onClick={() => zoomByCenter(0.8)} aria-label={t("diagram.zoomOut")} title={t("diagram.zoomOut")}><Minus size={16} /></button>
        <button onClick={fit} aria-label={t("diagram.reset")} title={t("diagram.reset")}><Maximize2 size={16} /></button>
        <button onClick={() => setSource(null)} aria-label={t("nav.close")} title={t("nav.close")} autoFocus><X size={16} /></button>
      </div>
      <div className="mv-zoom-hint">{t("diagram.hint")}</div>
    </div>
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
      <DiagramZoom dep={currentDoc} />
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
