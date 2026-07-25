/* ============================================================
   mdx-viewer · 需要浏览器运行时的组件 + 落款
   ============================================================ */
import React from "react";
import katex from "katex";
import { usePreferences } from "../PreferencesProvider";

/** <Math tex="..."/> 扩展组件（官方 $...$ 由 rehype-katex 处理，二者可共存）。 */
export function Math({ tex, display }: { tex: string; display?: string }) {
  const isDisplay = display !== "inline";
  const html = katex.renderToString(tex || "", {
    displayMode: isDisplay,
    throwOnError: false,
    output: "html",
  });
  const Tag = isDisplay ? "div" : "span";
  return <Tag className={isDisplay ? "mv-math-display" : ""} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Footer({ children }: React.PropsWithChildren) {
  return <footer className="mv-footer"><div className="ft">{children}</div></footer>;
}

const REPO_URL = "https://github.com/yanxuan-lc/mdx-viewer";
const GITHUB_LOGO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'%3E%3Cpath fill='black' d='M12 .297c-6.63 0-12 5.373-12 12c0 5.303 3.438 9.8 8.205 11.385c.6.113.82-.258.82-.577c0-.285-.01-1.04-.015-2.04c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729c1.205.084 1.838 1.236 1.838 1.236c1.07 1.835 2.809 1.305 3.495.998c.108-.776.417-1.305.76-1.605c-2.665-.3-5.466-1.332-5.466-5.93c0-1.31.465-2.38 1.235-3.22c-.135-.303-.54-1.523.105-3.176c0 0 1.005-.322 3.3 1.23c.96-.267 1.98-.399 3-.405c1.02.006 2.04.138 3 .405c2.28-1.552 3.285-1.23 3.285-1.23c.645 1.653.24 2.873.12 3.176c.765.84 1.23 1.91 1.23 3.22c0 4.61-2.805 5.625-5.475 5.92c.42.36.81 1.096.81 2.22c0 1.606-.015 2.896-.015 3.286c0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'/%3E%3C/svg%3E";

function formatAttribution(t: (key: string, values?: Record<string, unknown>) => string, author?: string, datetime?: string): string | undefined {
  if (author && datetime) return t("colophon.byOn", { author, datetime });
  if (author) return t("colophon.by", { author });
  if (datetime) return t("colophon.on", { datetime });
  return undefined;
}

/** 底部落款：文档信息（作者·日期时间·版权方，均来自 frontmatter，提供才显示）+ 固定的工具署名。 */
export function Colophon({
  author,
  datetime,
  copyright,
}: {
  author?: string;
  datetime?: string;
  copyright?: string;
}) {
  const { t } = usePreferences();
  const copyrightLine = copyright ? `© ${new Date().getFullYear()} ${copyright}` : undefined;
  const attribution = formatAttribution(t, author, datetime);
  const meta = [attribution, copyrightLine].filter(Boolean).join("  ·  ");
  return (
    <div className="mv-colophon">
      {meta && <div className="mv-colophon-meta">{meta}</div>}
      <a
        className="mv-colophon-brand"
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={t("colophon.github", { version: __MDXV_VERSION__, license: __MDXV_LICENSE__ })}
      >
        <img src={GITHUB_LOGO} alt="" aria-hidden="true" />
        <span>yanxuan-lc/mdx-viewer</span>
        <span aria-hidden="true">·</span>
        <span>{__MDXV_VERSION__}</span>
        <span aria-hidden="true">·</span>
        <span>{__MDXV_LICENSE__}</span>
      </a>
    </div>
  );
}
