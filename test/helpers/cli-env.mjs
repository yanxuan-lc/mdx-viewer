/* 子进程 CLI 测试共用的环境构造。
   不叫 *.test.mjs 是刻意的：`npm test` 的 glob 是 test/*.test.mjs，改名会把它当测试文件收进去。
   使用方：test/cli-language.test.mjs（L2）与 test/cli-export.test.mjs（L3）—— 同一套 locale
   来源语义横跨两条车道，此前是两份逐字节相同的拷贝（code-review #B3）。 */

/**
 * 复制当前环境并套用覆盖；`MDXV_LANG: undefined` 表示**删掉**该变量而不是设成 "undefined"。
 * @param {Record<string, string | undefined>} overrides
 * @returns {Record<string, string | undefined>}
 */
export function environment(overrides = {}) {
  const next = { ...process.env, ...overrides };
  if (overrides.MDXV_LANG === undefined) delete next.MDXV_LANG;
  return next;
}

/**
 * 造一个 `--import` 用的 data: URL，把子进程里的系统语言探测替换掉。
 * @param {string} locale BCP 47 标签，或字面量 `"throw"` 表示让探测抛错（走 fallback 分支）
 * @returns {string} data: URL
 */
export function systemLocalePreload(locale) {
  const source = locale === "throw"
    ? "Intl.DateTimeFormat=()=>{throw new Error('unavailable')};"
    : `Intl.DateTimeFormat=()=>({resolvedOptions:()=>({locale:${JSON.stringify(locale)}})});`;
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
