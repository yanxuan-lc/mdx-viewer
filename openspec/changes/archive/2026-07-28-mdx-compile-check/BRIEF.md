# BRIEF — mdx-compile-check

Light grill. 行为面在与用户的对话中已被完整指定并确认，本文件只做固化。

## 问题（实测证据，非推测）

`mdxv` **启动成功不代表文档能编译**。MDX 编译是懒的：只在浏览器 `import("/@fs" + abs)`
那一刻发生（`src/app/main.tsx`）。对一份编译不过的文档：

```
$ node bin/mdxv.mjs bad.mdx --no-open --port 4399
✓ Preview ready
  Documents        : 1
  Open             : → http://localhost:4399/?doc=…      ← 一片绿，进程常驻，退出码正常

$ curl -s -o /dev/null -w '%{http_code}' 'http://localhost:4399/@fs/…/bad.mdx'
500                                                      ← 破损只在这里暴露
```

产文档的 agent 因此拿到一个「看起来健康」的 URL 就交付，破损只有人打开时才发现。
本次触发案例：一份由 gen-ai-development 流程产出的 `.mdx`，硬折行把 `<global|tenant|workspace>`
顶到行首 → MDX 按 flow JSX 解析 → `Unexpected character \`|\` (U+007C) in name`（详见
`docs/tech/` 与 memory `mdx-line-start-angle-bracket`）。

现有替代手段 `mdxx <file> <out.html>` 确实能挡（实测破损 exit 1 / 正常 exit 0），但代价是
跑一整轮 Vite 生产构建（秒级），且错误被吞成一句 `Export failed`，拿不到 `line:column`。

## 目标

给 `mdxv` 加一个只做编译合法性校验的模式：毫秒级、精确定位、退出码可用作门禁。

## 已确认的行为（用户定）

- 入口：`mdxv --check <file|dir>`。
- **文件**：校验该篇。**目录**：按 `scanTree` 递归扫描所有 `.md`/`.mdx` 逐篇校验，逐条报告，
  有任一失败即 `exit 1`。
- 不起 server、不写任何产物、不开浏览器。
- 通过 `exit 0`；失败 `exit 1` 并打印 `file:line:column` + reason。
- 期望输出形状（用户确认的样例）：

  ```
  $ mdxv --check doc.mdx
  ✓ doc.mdx

  $ mdxv --check docs/
  ✓ docs/README.mdx
  ✗ docs/a.mdx:115:8  Unexpected character `|` (U+007C) in name
  ✓ docs/b.mdx
  2 passed, 1 failed
  $ echo $?
  1
  ```

## 边界（明确不做）

- **不校验组件是否存在、属性值是否合法、排版是否好看。** 实测 `compile()` 对
  `<Foo bar="x" />`（未定义组件）与 `<Callout tone="不存在的值">` 均返回 OK ——
  前者要到浏览器运行时才抛 `Expected component ... to be defined`，后者静默失效。
  所以 `--check` 通过 = 「这份文档一定能打开」，**不等于**「这份文档是对的」。
  这个边界必须写进 CLI help 与文档，避免调用方高估它。
- 不给 `mdxx` 加同名 flag（一处足够）。
- 不做 `--json` 输出（无实际调用方需求，避免投机扩展）。

## 实现约束（沿用项目既有约定，非新决策）

- 必须用项目自己的 `mdxOptions()`（`src/mdx/plugins.mjs`）编译，而不是裸 `compile()`
  —— 否则校验通过而真实渲染失败，门就是假的。
- 报错文案走 `src/i18n/messages.mjs` + `t()`；着色走 `isColorEnabled()`（`src/cli/output.mjs`）。
- 双端一致性：`--check` 只是 `mdxv` 的一个模式，不得改动 `plugins.mjs` / `vite-config.mjs`
  的共享行为，`mdxv`(dev) 与 `mdxx`(导出) 两条既有路径必须不受影响。

## 下游消费方（跨仓库，本轨道之外）

`plugin-infra` 的 `mdx-artifact` skill（`/Users/yanxuan.lc/yanxuan-lc/excalivibe`，
当前 0.6.0）将在「交付前」调用本命令作为门禁：过了才起预览、才把 URL 交给用户。
该 skill 的修改走 skill-creator 轨道，不属于本变更；但**本变更的 flag 名与退出码语义
一旦被它硬编码即成跨仓库契约**，spec 需明确这一点。

## 非目标 / 后续

- 本轮不发版（用户定）：跑到 `merge` + `archive` + `docs-sync` 结束，`publish` 留 pending。
  skill 侧可先按新契约改文档，待用户点头再发。
