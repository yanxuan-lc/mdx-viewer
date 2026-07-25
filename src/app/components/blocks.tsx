/* ============================================================
   mdx-viewer · 自定义块组件库
   —— 语义参数（tone / ratio / status），不写颜色值；样式全在 theme.css。
   通过 MDXProvider 注入，作者写 <Callout> 等无需 import。
   扩展新组件：在此新增一个组件，并在 ../mdx-components.tsx 的映射表登记一行。
   ============================================================ */
import React from "react";
import { Info, CheckCircle2, AlertTriangle, XCircle, ChevronRight } from "lucide-react";
import { usePreferences } from "../PreferencesProvider";

type Props = React.PropsWithChildren<Record<string, any>>;

export function Hero({ eyebrow, title, sub, date, stats, children }: Props) {
  return (
    <header className="mv-hero">
      <div className="mv-hero-inner">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h1>{title}</h1>}
        {sub && <p className="sub">{sub}</p>}
        {children && <div className="desc">{children}</div>}
        {Array.isArray(stats) && stats.length > 0 && (
          <div className="hero-stats">
            {stats.map((s: any, i: number) => (
              <div key={i}>
                <div className="v">{s.v}</div>
                <div className="l">{s.l}</div>
              </div>
            ))}
          </div>
        )}
        {date && <div className="date">{date}</div>}
      </div>
    </header>
  );
}

let _sec = 0;
export function resetSectionIds() { _sec = 0; }
export function Section({ number, eyebrow, title, anchor }: Props) {
  const id = anchor || `sec-${++_sec}`;
  return (
    <div className="mv-section" id={id} data-mv-section title={title}>
      {(number || eyebrow) && (
        <div>
          {number && <span className="num">{number}</span>}
          {number && eyebrow && " · "}
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        </div>
      )}
      <h2>{title}</h2>
    </div>
  );
}

const TONE_ICON: Record<string, any> = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };
export function Callout({ tone = "info", title, children }: Props) {
  const Icon = TONE_ICON[tone] || Info;
  return (
    <div className="mv-callout" data-tone={tone}>
      {title && <div className="ttl"><Icon size={16} strokeWidth={2.2} />{title}</div>}
      {children}
    </div>
  );
}

export function Card({ tone, title, badge, badgeTone, children }: Props) {
  return (
    <div className="mv-card" data-tone={tone}>
      {badge && <span className="badge" data-tone={badgeTone}>{badge}</span>}
      {title && <div className="ttl">{title}</div>}
      {children}
    </div>
  );
}

export function Columns({ ratio = "1:1", children }: Props) {
  return <div className="mv-columns" data-ratio={ratio}>{children}</div>;
}

export function Toggle({ title, open, children }: Props) {
  return (
    <details className="mv-toggle" open={open}>
      <summary><ChevronRight className="mv-toggle-chevron" size={16} />{title}</summary>
      <div className="body">{children}</div>
    </details>
  );
}

export function Steps({ children }: Props) { return <div className="mv-steps">{children}</div>; }
export function Step({ title, status, children }: Props) {
  return (
    <div className="mv-step" data-status={status}>
      {title && <div className="st-title">{title}</div>}
      {children}
    </div>
  );
}

export function Stats({ children }: Props) { return <div className="mv-stats">{children}</div>; }
export function Stat({ value, label, delta, dir }: Props) {
  return (
    <div className="mv-stat">
      <div className="v">{value}{delta && <span className="delta" data-dir={dir}>{delta}</span>}</div>
      <div className="l">{label}</div>
    </div>
  );
}

export function Fields({ children }: Props) { return <div className="mv-fields">{children}</div>; }
export function Field({ k, v }: Props) {
  return <div className="mv-field"><div className="k">{k}</div><div className="v">{v}</div></div>;
}

export function Scenario({ title, children }: Props) {
  return (
    <div className="mv-scenario">
      {title && <div className="st-title">{title}</div>}
      {children}
    </div>
  );
}
const gwt = (kw: string) => ({ children }: Props) => (
  <div className="gwt"><span className="kw">{kw}</span><span>{children}</span></div>
);
export const When = gwt("When");
export const And = gwt("And");
export const Then = gwt("Then");

export function Figure({ caption, children }: Props) {
  return (
    <figure className="mv-figure">
      {children}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export function Badge({ tone, dot, children }: Props) {
  return <span className="mv-badge" data-tone={tone}>{dot && <span className="dot" />}{children}</span>;
}

export function Code({ filename, children }: Props) {
  return (
    <div className="mv-card" style={{ padding: 0, overflow: "hidden" }}>
      {filename && <div style={{ padding: "6px 14px", fontSize: ".8rem", fontFamily: "var(--font-mono)", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>{filename}</div>}
      <pre style={{ margin: 0, border: 0, borderRadius: 0 }}><code>{children}</code></pre>
    </div>
  );
}

/** 交互：可筛选卡片网格。facets="id:标签,id:标签"，Item 的 tags 空格分隔。 */
export function Grid({ filterable, facets, children }: Props) {
  const { t } = usePreferences();
  const facetList: { id: string; label: string }[] = String(facets || "")
    .split(",").map((s) => s.trim()).filter(Boolean)
    .map((f) => { const [id, label] = f.split(":"); return { id, label: label || id }; });
  const [active, setActive] = React.useState<string | null>(null);
  const items = React.Children.toArray(children);
  return (
    <div>
      {filterable && facetList.length > 0 && (
        <div className="mv-grid-facets">
          <button className="mv-facet" aria-pressed={active === null} onClick={() => setActive(null)}>{t("grid.all")}</button>
          {facetList.map((f) => (
            <button key={f.id} className="mv-facet" aria-pressed={active === f.id} onClick={() => setActive(f.id)}>{f.label}</button>
          ))}
        </div>
      )}
      <div className="mv-grid">
        {items.map((child: any, i) => {
          const tags = String(child?.props?.tags || "").split(/\s+/).filter(Boolean);
          const hidden = active !== null && !tags.includes(active);
          return <div key={i} hidden={hidden}>{child}</div>;
        })}
      </div>
    </div>
  );
}
export function Item({ children }: Props) { return <div className="mv-item">{children}</div>; }
