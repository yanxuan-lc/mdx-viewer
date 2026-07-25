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

test("版本注入：落款含 1.0.0", () => {
  assert.ok(html.includes("1.0.0"), "__MDXV_VERSION__ 应注入为 1.0.0");
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

test("S10: 英文导出保留本地化偏好所需的离线页面契约", () => {
  assert.match(html, /<html[^>]+lang=["']en-US["']/i, "--lang en-US 应注入英文初始页面语言");
  assert.ok(html.includes("mv-locale"), "导出页应包含语言偏好持久化逻辑");
  assert.ok(html.includes("mv-theme"), "导出页应包含主题偏好持久化逻辑");
  assert.ok(html.includes("Edited by"), "导出页的产品落款应使用英文固定文案");
});
