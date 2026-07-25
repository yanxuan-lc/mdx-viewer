# AGENTS.md — mdx-viewer

面向所有 Agent（Claude Code / Cursor / Codex / Gemini / Aider 等）的项目事实。

## 项目简介

本地 MDX 渲染器。两个命令：

- `mdxv <file|dir>` —— 起 Vite dev server 在浏览器预览 MDX（热更新）。
- `mdxx <file>` —— 导出自包含、零外链、可离线双击打开的单文件 HTML。

设计目标：**官方 MDX 语法 100% 兼容**（底座即官方参考实现），在此之上用 `MDXProvider`
扩展一套语义化组件与统一的 HTML+CSS 模板样式。

## 技术栈

- **运行时/语言**：Node ≥ 20，ESM。CLI 侧用纯 `.mjs`（Node 直接执行，无编译步骤）；
  浏览器应用用 `.tsx`（由 Vite 转译，无独立 tsc 步骤）。
- **编译 + 开发服务器**：Vite 6 + `@mdx-js/rollup`（MDX v3 官方 Rollup 插件）。
- **渲染运行时**：React 18 + `@mdx-js/react`（MDXProvider 注入组件映射）。
- **官方 MDX 扩展插件**：`remark-gfm`、`remark-frontmatter` + `remark-mdx-frontmatter`、
  `remark-math` + `rehype-katex`、`rehype-pretty-code`(Shiki)。
- **图**：`@hpcc-js/wasm`(Graphviz)、`mermaid`。
- **CLI/导出**：`cac`（参数解析）、`open`（打开浏览器）、`vite-plugin-singlefile`（内联导出）。

## 目录结构

```
bin/
  mdxv.mjs          预览命令入口
  mdxx.mjs          导出命令入口
src/
  cli/
    resolve.mjs     入参解析（file/dir 判定）+ 目录 .md/.mdx 递归扫描
    vite-config.mjs 共享 Vite 配置构建器（view 与 build 共用）
    plugin.mjs      Vite 插件：虚拟模块 + 目录 tree 中间件
  mdx/
    plugins.mjs     MDX 编译插件清单（兼容性核心）
    diagrams.mjs    dot/mermaid/svg 三车道 rehype 插件
  app/
    index.html      Vite 入口 HTML
    main.tsx        浏览器入口（按 config 加载单篇或目录中某篇）
    Layout.tsx      标准模板骨架（frontmatter 驱动 Hero/TOC/落款/主题）
    mdx-components.tsx  MDXProvider 组件映射表（OCP 扩展位）
    components/
      blocks.tsx    自定义块组件（Hero/Section/Callout/…）
      client.tsx    需浏览器运行时的组件（Math/Footer/Colophon）
    styles/theme.css  一套语义 token 驱动的 HTML+CSS 模板
    global.d.ts     define 注入变量 + 虚拟模块类型声明
demo/               index.mdx —— 随包组件总览示例（`mdxv demo`）
examples/           demo.mdx（全特性）+ guide/intro.md（.md + 相对链接）
test/               node --test 三层：resolve(单元) / mdx-pipeline(集成) / export(冒烟)
                    fixtures/export-sample.mdx —— 导出冒烟样例
```

## 命令

**统一前门是 `make`**：`make`（或 `make help`）列出全部可用命令，按 general / run / maintain
分组。Makefile 是薄封装，底层仍调 `npm` 与 `bin/`；下表为其映射与直接调用等价。

| make | 直接命令 | 作用 |
|---|---|---|
| `make install` | `npm install` | 安装依赖（首次） |
| `make link` | `npm link` | 全局注册 `mdxv` / `mdxx` |
| `make demo` | `mdxv demo` | 打开内置组件总览示例 |
| `make view FILE=<f\|dir> [ARGS=…]` | `mdxv <f\|dir>` | 预览 |
| `make export FILE=<f> [OUT=…]` | `mdxx <f>` | 导出自包含 HTML |
| `make test` | `npm test` | 全部测试（单元 + 集成 + 导出冒烟） |
| `make test-unit` | `npm run test:unit` | 仅单元 + 集成（快，无 vite 构建） |
| `make test-export` | `npm run test:export` | 仅导出自包含冒烟（含 vite 构建，较慢） |
| `make clean` | — | 删除 `node_modules` 与导出的 `.html` |

底层命令细节：

| 命令 | 作用 |
|---|---|
| `npm install` | 安装依赖（首次） |
| `npm link` | 可选：全局注册 `mdxv` / `mdxx` |
| `mdxv demo` | 打开随包内置的组件总览示例（`demo/index.mdx`） |
| `mdxv <file>` | 以文件所在目录为根，默认打开该文件（`npm run dev -- <file>` 等价） |
| `mdxv <dir>` | 以该目录为根，默认打开首篇（优先 README/index） |
| `mdxv <file> --port <n> --host --no-open` | 端口/监听/不自动开浏览器 |
| `mdxx <file> [out.html]` | 导出自包含 HTML（`npm run build:html -- <file>` 等价） |

> **`mdxv` 行为统一**：无论文件还是目录都以「根目录 + 默认文档」运作（见 `src/cli/resolve.mjs`
> 的 `resolveInput` / `pickDefaultDoc`）。根目录下多篇时显示左侧导航，仅一篇时不显示。

### 测试

测试用 Node 内置 `node --test`（**零第三方测试依赖**），三层放在 `test/`：

| 文件 | 层次 | 覆盖 | 特点 |
|---|---|---|---|
| `test/resolve.test.mjs` | 单元 | `src/cli/resolve.mjs`：`resolveInput` / `scanTree` / `pickDefaultDoc` | fixture 树在系统临时目录现建现清，纯逻辑、快 |
| `test/mdx-pipeline.test.mjs` | 集成 | `src/mdx/plugins.mjs` 编译管线：frontmatter / GFM / 数学 / 高亮 / 图三车道 | 用官方 `@mdx-js/mdx` 的 `compile()` 跑 `mdxOptions()`，断言编译产物标记 |
| `test/export.test.mjs` | 端到端冒烟 | `bin/mdxx.mjs` 导出：零外链、base64 内联、版本注入 | 真实 `vite build`，产物写临时目录不落仓库，较慢（~7s） |

- `test/fixtures/export-sample.mdx` 是导出测试的最小样例（committed）。
- **仍无 lint / typecheck 脚本**：应用侧 `.tsx` 走 Vite 宽松转译，无独立 tsc 门禁。
- 加新纯逻辑模块时优先补 `test/*.test.mjs` 单测；改编译管线补集成断言；碰自包含约束补导出冒烟断言。

## 架构要点

- **view（mdxv）**：程序化 `createServer` 启动 Vite，始终以「根目录 + 默认文档」运作。
  扫描根目录下 `.md`/`.mdx` 暴露 `GET /__mdxv/tree`，前端按 `?doc=<绝对路径>` 用 `/@fs`
  动态加载、路由相对链接、多篇时渲染左侧导航。`virtual:mdxv-config` 把 `{mode, firstDoc}`
  注入前端。（虚拟模块 `virtual:mdx-target` 仅 build 用。）
- **build（mdxx）**：单篇经 `virtual:mdx-target` re-export 目标 `.mdx`，走 `vite build` +
  `vite-plugin-singlefile`，`assetsInlineLimit` 拉满，KaTeX 字体、用到的 Mermaid 运行时全部
  base64 内联，产出零外链单文件。
- **图三车道**（`src/mdx/diagrams.mjs`，在 `rehype-pretty-code` 之前运行）：
  - `dot`/`graphviz` → 构建期 Graphviz(wasm) 出静态 SVG，零运行时；
  - `mermaid` → 转 `<pre class="mermaid">`，客户端渲染，主题跟随明暗；
  - `svg` → 原样内联。

## MDX 兼容基线

底座是官方 `@mdx-js/rollup`（MDX v3），故 CommonMark + JSX + `{}` 表达式 + ESM
`import`/`export` 全按官方标准解析。官方推荐的扩展按原版接入（见 `src/mdx/plugins.mjs`）：
frontmatter 走完整 YAML 并导出 `frontmatter`；数学用官方 `$...$` / `$$...$$`；
GFM 表格/任务清单/删除线；Shiki 双主题高亮。**改动编译管线时以「不破坏官方兼容」为红线。**

## 扩展组件（OCP）

1. 在 `src/app/components/blocks.tsx`（或 `client.tsx`，若需浏览器运行时）写一个 React 组件；
2. 在 `src/app/mdx-components.tsx` 的映射表加一行 `标签名: 组件`。

核心渲染管线无需改动。样式**只用语义参数**（`tone`/`ratio`/`status` 等），颜色值写在
`theme.css` 的 CSS 变量里，不在组件里硬编码色值。

现有组件：`Hero` `Section` `Callout` `Card` `Columns` `Toggle` `Steps`/`Step`
`Stats`/`Stat` `Fields`/`Field` `Scenario`/`When`/`And`/`Then` `Grid`/`Item`(可筛选)
`Badge` `Figure` `Math` `Code` `Footer` `Colophon`。

## 代码风格约定

- CLI/构建侧文件用 `.mjs` + JSDoc 注释；应用侧用 `.tsx`（宽松 TS，无强类型门禁）。
- 注释与文档以中文为主，与既有文件保持一致。
- 组件用 `className` + `data-*` 属性对接 `theme.css`，避免内联样式（少量一次性样式除外）。
- 明暗与配色只经 `<html>` 上的 `data-theme` / `data-palette` / `data-density` 切换。

## 已知陷阱

- **相对链接路由**（目录模式）假设根在启动目录之内；跨盘符 / 软链场景未做边界处理。
- **自动 Hero** 仅在 frontmatter 有 `title` 且 `hero !== false` 时生成；若在正文显式写
  `<Hero>`，请在 frontmatter 设 `hero: false` 或不写 `title`，避免出现两个 Hero。
- **Mermaid 体积**：用到 mermaid 的页/导出会内联其运行时（较大）；没用到则零成本。
- **生成时间**：view 模式在运行时取当前时间；导出（mdxx）在构建时刻注入（精确到秒）。
- **组件 children 里的裸 `{}` / `<`** 会被 MDX 当 JS 表达式 / JSX 解析而报错。要放字面量
  （如 `<Code>` 里的 JSON、含泛型的代码），用 `` {`...`} `` 模板字符串表达式，或改用 Markdown 围栏。
- **尚未 `git init`**：当前目录不是 git 仓库；提交前需先初始化。

## 术语表

- **MDX**：Markdown + JSX 组件的文档格式；本项目用官方 MDX v3 编译。
- **frontmatter**：文档顶部 `--- ... ---` 的 YAML 元信息，驱动主题与模板骨架。
- **三车道**：dot / mermaid / svg 三种围栏图的分派策略。
- **落款（Colophon）**：页面底部由 frontmatter 驱动的文档信息（`author` · `datetime` ·
  `copyright`，均可选、提供才显示）；`datetime` 格式为 `yyyy-MM-dd HH:mm:ss`，版权由模板渲染为
  `© 当前年份 {copyright}`。下方固定显示项目仓库、版本与许可证推广链接。
- **虚拟模块**：`virtual:mdx-target` / `virtual:mdxv-config`，由 `src/cli/plugin.mjs` 提供。
