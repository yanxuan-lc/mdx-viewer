/* ESM loader 钩子：把 `vite` 包一层，记录哪些入口被真正调用过。
   仅测试用（由 preload.mjs 经 --import 注册），产品代码永远不加载它。
   被包的入口只有 WRAPPED 这一处清单，导出的 __mdxvProbedExports 也由它生成 ——
   两者不可能对不上，测试因此能直接断言探针到底覆盖了哪些入口。 */
const MARK = "?mdxv-vite-call-probe";
const WRAPPED = ["build", "createServer"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier !== "vite") return nextResolve(specifier, context);
  const resolved = await nextResolve(specifier, context);
  if (resolved.url.includes(MARK)) return resolved;
  return { ...resolved, url: `${resolved.url}${MARK}`, shortCircuit: true };
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith(MARK)) return nextLoad(url, context);
  const real = JSON.stringify(url.slice(0, -MARK.length));
  const wrappers = WRAPPED.map((name) => {
    const key = JSON.stringify(name);
    return `export const ${name} = (...args) => { note(${key}); return real[${key}](...args); };`;
  }).join("\n      ");
  return {
    format: "module",
    shortCircuit: true,
    source: `
      import { appendFileSync } from "node:fs";
      import * as real from ${real};
      const note = (name) => appendFileSync(process.env.MDXV_PROBE_OUT, name + "\\n");
      ${wrappers}
      export const __mdxvProbedExports = ${JSON.stringify(WRAPPED)};
      export * from ${real};
    `,
  };
}
