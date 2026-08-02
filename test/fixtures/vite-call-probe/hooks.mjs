/* ESM loader 钩子：记录被观察进程（及其派生的子进程）到底做了什么。
   仅测试用（由 preload.mjs 经 --import 注册），产品代码永远不加载它。

   记录两类事实，写进 $MDXV_PROBE_OUT，每行一条：
     `build` / `createServer`   —— vite 的构建 / dev server 入口被调用
     `spawn:<fn>`               —— 派生了子进程（node:child_process 的七个入口）

   为什么两类合在**一个**钩子模块里：分别注册两个 loader 钩子会互相干扰——实测把
   两个 `--import` 一起塞进 NODE_OPTIONS 会让 vite 那一半的计数静默变成 0。

   派生这一类是为了堵住 code-review 记下的逃逸路径：`--import` 经 NODE_OPTIONS 传递时
   子进程会继承，但**子进程若被显式传入一份不含 NODE_OPTIONS 的 env 就不会**。那时子进程
   里的 vite 调用看不见，可「派生」这个动作本身在父进程里仍然看得见——所以判据从
   「没调用 vite」加强成「既没调用 vite，也没派生任何进程」。 */
const MARK = "?mdxv-vite-call-probe";
const WRAPPED = ["build", "createServer"];
const SPAWNERS = ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"];

const TARGETS = new Map([
  ["vite", { kind: "vite", real: null }],
  ["node:child_process", { kind: "proc", real: "node:child_process" }],
  ["child_process", { kind: "proc", real: "node:child_process" }],
]);

export async function resolve(specifier, context, nextResolve) {
  const target = TARGETS.get(specifier);
  if (!target) return nextResolve(specifier, context);
  // 合成模块自己回引真身时必须放行，否则 `real` 解析回钩子本身 → 无限递归。
  if (context.parentURL?.endsWith(MARK)) return nextResolve(specifier, context);
  if (target.kind === "proc") return { url: `node:child_process${MARK}`, shortCircuit: true, format: "module" };
  const resolved = await nextResolve(specifier, context);
  return { ...resolved, url: `${resolved.url}${MARK}`, shortCircuit: true };
}

const NOTE = `
      import { appendFileSync } from "node:fs";
      const note = (name) => {
        // 写进**每一个**已配置的槽，不是挑一个：单篇测试用自己的私有槽做断言，
        // 车道级测量用共享槽数总数，两者必须同时拿到同一条记录。早先版本让私有槽
        // 优先，于是车道级计数漏掉了那个文件的子进程（code-review #B13）。
        const sinks = [process.env.MDXV_PROBE_OUT_S12, process.env.MDXV_PROBE_OUT].filter(Boolean);
        // 一个都没设说明探针被误用了。静默吞掉会让断言空洞，所以点名说清楚。
        if (!sinks.length) throw new Error("vite-call-probe: no MDXV_PROBE_OUT_S12 / MDXV_PROBE_OUT sink is set, so " + name + " cannot be recorded");
        for (const out of sinks) appendFileSync(out, name + "\\n");
      };
`;

export async function load(url, context, nextLoad) {
  if (!url.endsWith(MARK)) return nextLoad(url, context);

  if (url.startsWith("node:child_process")) {
    const wrappers = SPAWNERS.map((name) => {
      const key = JSON.stringify(`spawn:${name}`);
      return `export const ${name} = (...args) => { note(${key}); return real[${JSON.stringify(name)}](...args); };`;
    }).join("\n      ");
    return {
      format: "module",
      shortCircuit: true,
      source: `${NOTE}
      import realDefault, * as real from "node:child_process";
      ${wrappers}
      export const __mdxvProbedSpawners = ${JSON.stringify(SPAWNERS)};
      // export-star 不转发 default，而 vite 打包产物里有 "import childProcess from node:child_process"
      // 这种默认导入——少了下面这一行，一旦 vite 被 import 进来就是 SyntaxError（实测过）。
      export default realDefault;
      export * from "node:child_process";
    `,
    };
  }

  const real = JSON.stringify(url.slice(0, -MARK.length));
  const wrappers = WRAPPED.map((name) => {
    const key = JSON.stringify(name);
    return `export const ${name} = (...args) => { note(${key}); return real[${key}](...args); };`;
  }).join("\n      ");
  return {
    format: "module",
    shortCircuit: true,
    source: `${NOTE}
      import * as real from ${real};
      ${wrappers}
      export const __mdxvProbedExports = ${JSON.stringify(WRAPPED)};
      export * from ${real};
    `,
  };
}
