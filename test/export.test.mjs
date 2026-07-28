/* ============================================================
   端到端冒烟测试 · bin/mdxx.mjs（自包含导出）
   —— 跑一次真实导出（vite build + singlefile），断言产物「零外链、可离线」：
      无 http(s)/协议相对的 link/script/字体引用，且确有 base64 内联资源。
      产物写入系统临时目录，不落仓库。较慢（含首次 vite 构建），故单列。
   ============================================================ */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const FIXTURE = join(REPO, "test", "fixtures", "export-sample.mdx");
const { version: PKG_VERSION } = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));

let outDir, outHtml, html;

before(() => {
  outDir = mkdtempSync(join(tmpdir(), "mdxv-export-"));
  outHtml = join(outDir, "out.html");
  // 用当前 node 跑 bin，避免依赖 PATH 中的 node；构建较慢，给足超时。
  execFileSync(process.execPath, ["bin/mdxx.mjs", FIXTURE, outHtml, "--lang", "en-US"], {
    cwd: REPO,
    timeout: 180000,
    stdio: "pipe",
  });
  html = readFileSync(outHtml, "utf8");
});

after(() => rmSync(outDir, { recursive: true, force: true }));

test("导出产物生成且体积合理", () => {
  assert.ok(existsSync(outHtml), "应生成 out.html");
  assert.ok(html.length > 20 * 1024, "自包含产物应至少数十 KB");
  assert.ok(html.includes("Export Sample"), "应含正文标题");
});

test("版本注入：落款含 package.json 版本", () => {
  // 版本经 vite define 注入为 JS 字符串字面量（运行时渲染，不进静态 DOM）；
  // 用带引号形态锚定，避免命中 5MB 产物里别处偶然出现的同形版本串。
  assert.ok(html.includes(`"${PKG_VERSION}"`), `__MDXV_VERSION__ 应注入为 ${PKG_VERSION}`);
});

test("frontmatter 落款字段：包含作者、日期时间、版权方与 Footer", () => {
  assert.ok(html.includes("mdx-viewer test"), "应包含 author");
  assert.ok(html.includes("Edited by"), "作者前应使用正确的英文表达 Edited by");
  assert.ok(html.includes("2026-07-25 12:00:00"), "应包含 yyyy-MM-dd HH:mm:ss 格式的 datetime");
  assert.ok(html.includes("yanxuan-lc"), "应包含不带年份的 copyright 版权方");
  assert.ok(html.includes("Export fixture footer."), "应包含 footer");
});

test("落款推广链接：仓库名与 GitHub 图标整体可点击", () => {
  assert.ok(html.includes("https://github.com/yanxuan-lc/mdx-viewer"), "落款应链接到 GitHub 仓库");
  assert.ok(html.includes("yanxuan-lc/mdx-viewer"), "落款应显示完整仓库名");
  assert.ok(html.includes("MIT"), "落款应显示 package.json 中的许可证");
  assert.ok(html.includes("data:image/svg+xml,%3Csvg"), "推广链接应内联 GitHub SVG 图标");
});

test("零外链：无 http(s)/协议相对的 link/script/资源引用", () => {
  assert.ok(!/<link[^>]+href=["']https?:\/\//i.test(html), "不应有外链样式表");
  assert.ok(!/<script[^>]+src=["']https?:\/\//i.test(html), "不应有外链脚本");
  assert.ok(!/<(?:link|script|img)[^>]+(?:href|src)=["']\/\//i.test(html), "不应有协议相对引用");
  assert.ok(!/url\(\s*["']?https?:\/\//i.test(html), "CSS 不应外链资源");
});

test("脚本/样式已内联：无指向本地文件的 src/href", () => {
  // singlefile 应把 JS 内联；不应残留指向本地打包产物的 module script。
  assert.ok(!/<script[^>]+src=["'](?!data:)[^"']+["']/i.test(html), "不应残留外部 script src");
  assert.ok(!/<link[^>]+rel=["']stylesheet["']/i.test(html), "样式应内联，不应有 stylesheet link");
});

test("确有 base64 内联资源（字体/图片）", () => {
  assert.ok(/data:font|data:image|;base64,/i.test(html), "应含 base64 内联资源");
  // KaTeX 字体应内联，不应以 .woff2 路径外链
  assert.ok(!/url\((?!data:)[^)]*\.woff2/i.test(html), "字体不应以文件路径外链");
});

test("图内语义色：class→真实颜色的绑定确实写进了导出产物（CHECKLIST.md #B2）", () => {
  // 背景：diagram-theme.test.mjs 的 30+ 个用例严密守着「hast 层的 class 打对了没」，
  // 但那一半只证明 class 落点正确，不证明 theme.css 里对应的颜色声明真的存在——
  // 实测把 theme.css 里这几条语义色规则整段删掉，diagram-theme + mdx-pipeline
  // 仍然全绿，因为没有任何测试读 theme.css 的内容。这条断言钉住「class → 真实
  // 颜色」这一半：直接检查导出产物里内联 CSS 的声明文本，而不是只看 class 有没有
  // 打上。两档特异度（见 src/app/styles/theme.css 顶部注释）在这里逐一钉死：
  // 表现属性来源（不带 !important，留给作者的 SVG 内部 <style> 仍能翻盘）、
  // 内联 style 来源（带 !important）。
  const ruleOf = (selector) => {
    const start = html.indexOf(`${selector}{`);
    assert.ok(start !== -1, `导出产物内联 CSS 应包含选择器 ${selector}`);
    const end = html.indexOf("}", start);
    return html.slice(start + selector.length + 1, end);
  };
  assert.equal(ruleOf(".mv-diagram-fg-fill"), "fill:currentColor");
  assert.equal(ruleOf(".mv-diagram-fg-fill-style"), "fill:currentColor!important");
  assert.equal(ruleOf(".mv-diagram-fg-stroke"), "stroke:currentColor");
  assert.equal(ruleOf(".mv-diagram-fg-stroke-style"), "stroke:currentColor!important");
  assert.equal(ruleOf(".mv-diagram-bg-fill"), "fill:var(--surface)");
  assert.equal(ruleOf(".mv-diagram-bg-fill-style"), "fill:var(--surface)!important");
  assert.equal(ruleOf(".mv-diagram-bg-stroke"), "stroke:var(--surface)");
  assert.equal(ruleOf(".mv-diagram-bg-stroke-style"), "stroke:var(--surface)!important");
});

test("图内缺省色：根 <svg> 的 fill=currentColor 与它依赖的 color 声明都在导出产物里", () => {
  // 缺省色（「谁都没声明 fill」那一种，也就是 Graphviz 文字不可见的本因）不走 class，
  // 而是「根 <svg> 上的 fill=currentColor」+「.mv-diagram 上的 color」两半合起来生效。
  // 上一条 #B2 断言只覆盖了 class 那几条规则，这两半同样需要在真实产物上钉住——
  // 任何一半掉了，深色主题下图内文字就又看不见了，而单测的 class 断言不会发现。
  // 注意产物形态：导出是单文件 React 应用，图不是静态 HTML 而是打进 bundle 的 JSX，
  // 所以这里锚定的是 props 形态 `fill:"currentColor"` 而非 `<svg fill="…">`。
  // 两条断言故意拆开、各自独立：以前写成一条把 xmlns / fill / maxWidth 串在同一个
  // props 对象里的正则，等于把断言绑在 JSX 属性的书写顺序上——删掉一个无关的
  // 尺寸声明就会让它红，而那与本条要守的「缺省色进了产物」毫无关系。
  assert.match(
    html,
    /xmlns:"http:\/\/www\.w3\.org\/2000\/svg"/,
    "前提断言：产物里确有根 svg 的 JSX（否则下一条会空守）",
  );
  assert.match(
    html,
    /fill:"currentColor"/,
    "根 svg 必须带缺省前景色属性（否则深色下图内文字又是黑的）",
  );
  const start = html.indexOf(".mv-diagram{");
  assert.ok(start !== -1, "导出产物应包含 .mv-diagram 规则");
  const decls = html.slice(start, html.indexOf("}", start));
  assert.match(decls, /color:var\(--ink\)/, "currentColor 要能解析成随主题联动的前景色");

  // 图的响应式宽度以前靠往根 svg 注入内联 style，现已删除（与这条规则完全重复，且
  // 会吃掉作者写在根上的 style）。既然唯一的保证只剩这条 CSS，就在真实产物里钉住它。
  const sizing = html.indexOf(".mv-diagram svg{");
  assert.ok(sizing !== -1, "导出产物应包含 .mv-diagram svg 规则");
  const sizingDecls = html.slice(sizing, html.indexOf("}", sizing));
  assert.match(sizingDecls, /max-width:100%/, "宽度不溢出的保证现在只在这里，必须存在");
  assert.match(sizingDecls, /height:auto/, "等比缩放同理");
});

test("S10: 英文导出保留本地化偏好所需的离线页面契约", () => {
  assert.match(html, /<html[^>]+lang=["']en-US["']/i, "--lang en-US 应注入英文初始页面语言");
  assert.ok(html.includes("mv-locale"), "导出页应包含语言偏好持久化逻辑");
  assert.ok(html.includes("mv-theme"), "导出页应包含主题偏好持久化逻辑");
  assert.ok(html.includes("Edited by"), "导出页的产品落款应使用英文固定文案");
});
