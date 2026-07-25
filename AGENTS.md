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
    resolve.mjs     入参解析（file/dir 判定）+ 目录 .md/.mdx 递归扫描（含 locale 族元信息）
    vite-config.mjs 共享 Vite 配置构建器（view 与 build 共用）
    plugin.mjs      Vite 插件：虚拟模块 + 目录 tree 中间件
    language.mjs    CLI 语言判定（--lang > MDXV_LANG > 系统 Locale > 兜底）+ CliLanguageError
    localized-docs.mjs  .zh-CN/.en-US 文件族识别（不依赖 Node，预览客户端复用）
    output.mjs      终端呈现：ANSI 着色判定、help/error 格式化
  mdx/
    plugins.mjs     MDX 编译插件清单（兼容性核心）
    diagrams.mjs    dot/mermaid/svg 三车道 rehype 插件
  i18n/
    locale.mjs      SUPPORTED_LOCALES（zh-CN/en-US）+ `t()` 取词 + 系统 Locale 归一
    messages.mjs    产品文案目录（作者的 MDX 内容永不进入此表）
  app/
    index.html      Vite 入口 HTML
    main.tsx        浏览器入口（按 config 加载单篇或目录中某篇）
    Layout.tsx      标准模板骨架（frontmatter 驱动 Hero/TOC/落款/主题）
    mdx-components.tsx  MDXProvider 组件映射表（OCP 扩展位）
    preferences.mjs 偏好纯逻辑：主题三态 auto/light/dark、LocalStorage 读写、浏览器 Locale
    PreferencesProvider.tsx  偏好 + 语言的 React Context（`usePreferences()` 提供 `t`）
    local-document-links.mjs  浏览器侧纯路径解析（统一 POSIX/Windows 物理文档路径）
    components/
      blocks.tsx    自定义块组件（Hero/Section/Callout/…）
      client.tsx    需浏览器运行时的组件（Math/Footer/Colophon）
    styles/
      theme.css     一套语义 token 驱动的 HTML+CSS 模板
      fonts.css     内嵌 Source Serif 4 可变字体（latin 子集，构建时 base64 内联）
    global.d.ts     define 注入变量 + 虚拟模块类型声明
demo/               index.mdx + index.zh-CN.mdx —— 随包组件总览示例（`mdxv demo`）
examples/           demo.mdx（全特性）+ guide/intro.md（.md + 相对链接）
test/               node --test 单元 + 集成 + 导出冒烟（见下「测试」表）
                    fixtures/export-sample.mdx —— 导出冒烟样例
e2e/                Playwright 端到端：i18n-preferences / localized-document-variants /
                    empty-states 三个 spec + fixtures + empty-state-server.mjs（起临时 Vite）
scripts/publish.sh  发布门控脚本（版本核验 / git 门控 / 测试 / 打 tag，经 `make publish`）
openspec/           OpenSpec 规格库（非运行时代码）
  config.yaml       schema: spec-driven
  specs/            主 spec 树：cli-output / i18n-preferences /
                    localized-document-variants —— 已归档变更合并后的当前需求基线
  changes/          进行中的变更提案；完成后经 `openspec archive <id>` 移入
    archive/        已归档变更（`<date>-<id>/`，含 spec、tasks、各门报告与 PIPELINE 留痕）
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
| `make test` | `npm test` | 全部 node 测试（单元 + 集成 + 导出冒烟；**不含 e2e**） |
| `make test-unit` | `npm run test:unit` | 仅单元 + 集成（快，无 vite 构建） |
| `make test-export` | `npm run test:export` | 仅导出自包含冒烟（含 vite 构建，较慢） |
| `make test-e2e` | `npm run test:e2e` | Playwright 端到端（需先 `npx playwright install`） |
| `make publish` | `./scripts/publish.sh` | 发布到 npmjs（版本核验 + 门控 + 读 `.env` token + 打 tag） |
| `make publish-dry` | `DRY_RUN=1 ./scripts/publish.sh` | 发布演练，不真正发布也不打 tag |
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
| `mdxv <file> --lang <zh-CN\|en-US>` | 指定界面初始语言（优先级：`--lang` > `MDXV_LANG` > 系统 Locale） |
| `mdxx <file> [out.html]` | 导出自包含 HTML（`npm run build:html -- <file>` 等价） |
| `mdxx <file> --lang <zh-CN\|en-US>` | 指定导出页面的初始界面语言 |
| `mdxv --version` / `--help` | 版本号 / 本地化帮助（两个命令都支持，`src/cli/output.mjs` 渲染） |

> **`mdxv` 行为统一**：无论文件还是目录都以「根目录 + 默认文档」运作（见 `src/cli/resolve.mjs`
> 的 `resolveInput` / `pickDefaultDoc`）。根目录下多篇时显示左侧导航，仅一篇时不显示。

### 测试

`test/` 用 Node 内置 `node --test`（**零第三方测试依赖**）；`e2e/` 用 Playwright（唯一的
devDependency）。两者互不重叠：`npm test` 不跑 e2e，e2e 也不替代单测。

| 文件 | 层次 | 覆盖 | 特点 |
|---|---|---|---|
| `test/resolve.test.mjs` | 单元 | `src/cli/resolve.mjs`：`resolveInput` / `scanTree` / `pickDefaultDoc` | fixture 树在系统临时目录现建现清，纯逻辑、快 |
| `test/localized-docs.test.mjs` | 单元 | `src/cli/localized-docs.mjs`：`.zh-CN`/`.en-US` 文件族识别与归组 | 纯字符串逻辑 |
| `test/locale.test.mjs` | 单元 | `src/i18n/locale.mjs`：locale 判定、`t()` 取词、系统 Locale 归一 | 纯逻辑 |
| `test/cli-language.test.mjs` | 单元 | `src/cli/language.mjs`：`--lang` / `MDXV_LANG` / 系统 Locale 优先级与非法值报错 | 纯逻辑 |
| `test/cli-output.test.mjs` | 单元 | `src/cli/output.mjs`：ANSI 着色判定、help / error 格式化 | 纯逻辑 |
| `test/local-document-links.test.mjs` | 单元 | `src/app/local-document-links.mjs`：POSIX/Windows 路径归一与相对链接解析 | 纯逻辑 |
| `test/mdx-pipeline.test.mjs` | 集成 | `src/mdx/plugins.mjs` 编译管线：frontmatter / GFM / 数学 / 高亮 / 图三车道 | 用官方 `@mdx-js/mdx` 的 `compile()` 跑 `mdxOptions()`，断言编译产物标记 |
| `test/export.test.mjs` | 端到端冒烟 | `bin/mdxx.mjs` 导出：零外链、base64 内联、版本注入 | 真实 `vite build`，产物写临时目录不落仓库，较慢（~7s） |
| `e2e/i18n-preferences.spec.mjs` | e2e | 语言 / 主题三态切换、LocalStorage 持久化、跟随系统配色 | Playwright，`playwright.config.mjs` 起 dev server |
| `e2e/localized-document-variants.spec.mjs` | e2e | 文档族选择、导航去重、`?doc=` 归一、相对链接族内路由 | 用 `e2e/fixtures/localized/` |
| `e2e/empty-states.spec.mjs` | e2e | 空目录 / 渲染错误 / 非法 mode 等边界态 | 用 `e2e/empty-state-server.mjs` 起临时 Vite |

- `test/fixtures/export-sample.mdx` 是导出测试的最小样例（committed）。
- 版本号断言从 `package.json` 读，不写死——bump 版本不需要改测试。
- **仍无 lint / typecheck 脚本**：应用侧 `.tsx` 走 Vite 宽松转译，无独立 tsc 门禁。
- 加新纯逻辑模块时优先补 `test/*.test.mjs` 单测（**并把文件加进 `package.json` 的 `test:unit`
  显式清单**，否则 `make test-unit` 不会跑到它）；改编译管线补集成断言；碰自包含约束补导出冒烟
  断言；碰界面行为补 `e2e/` spec。

## 架构要点

- **view（mdxv）**：程序化 `createServer` 启动 Vite，始终以「根目录 + 默认文档」运作。
  扫描根目录下 `.md`/`.mdx` 暴露 `GET /__mdxv/tree`，前端按 `?doc=<绝对路径>` 用 `/@fs`
  动态加载、路由相对链接、多篇时渲染左侧导航。`virtual:mdxv-config` 把 `{mode, firstDoc}`
  注入前端。（虚拟模块 `virtual:mdx-target` 仅 build 用。）
- **build（mdxx）**：单篇经 `virtual:mdx-target` re-export 目标 `.mdx`，走 `vite build` +
  `vite-plugin-singlefile`，`assetsInlineLimit` 拉满，KaTeX 字体、用到的 Mermaid 运行时全部
  base64 内联，产出零外链单文件。
- **图三车道**（`src/mdx/diagrams.mjs`，在 `rehype-pretty-code` 之前运行）：三车道统一包一层
  `.mv-diagram` / `.mv-diagram-<kind>`。
  - `dot`/`graphviz` → 构建期 Graphviz(wasm) 出静态 SVG，零运行时；会剥掉 Graphviz 的白底
    多边形（按 `id="graph0"` 锚定）使其与 mermaid 一样透明，`svg` 车道的作者原图不动；
  - `mermaid` → 转 `<pre class="mermaid">`，客户端渲染，主题跟随明暗；
  - `svg` → 原样内联。
- **图表全屏预览**（`src/app/Layout.tsx`）：给每个 `.mv-diagram` 用 DOM 注入放大按钮，点击进
  全屏遮罩，支持光标锚定滚轮缩放、拖拽平移、缩放/适配/关闭工具栏、Esc 与点遮罩退出。缩放改
  SVG 由 `viewBox` 推出的固有 px 尺寸（不是 CSS `transform: scale`），故任意倍率都保持矢量清晰。
  view 与导出两条路径都生效。
- **语言与偏好**：产品文案集中在 `src/i18n/messages.mjs`（**作者的 MDX 内容永不进入**），
  经 `locale.mjs` 的 `t()` 取词。CLI 侧语言由 `src/cli/language.mjs` 判定（`--lang` >
  `MDXV_LANG` > 系统 Locale > 兜底）并注入前端；浏览器侧由 `PreferencesProvider.tsx` 提供
  Context，`usePreferences()` 给出 `t` 与切换动作。语言与 `auto/light/dark` 三态主题的手动
  选择存 LocalStorage；`auto` 下继续跟随系统配色变化。frontmatter 的 `mode` 是初始值。
- **文档语言变体**：同级 `guide.mdx` / `guide.zh-CN.mdx` / `guide.en-US.mdx` 归为一个文档族
  （`src/cli/localized-docs.mjs` 识别，`scanTree` 带出族元信息）。当前界面语言优先选精确变体，
  缺失回退无后缀基础文件；导航只显示一个逻辑条目，`?doc=` 与相对链接都按族归一。只有精确的
  `.zh-CN` / `.en-US` 后缀有此语义。**`mdxx` 不参与**：它只导出你传入的那个物理文件。

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
- **TOC 只在超宽视口出现**：`.mv-toc` 是 `position: fixed` 的 200px 右侧栏，`theme.css` 用
  `@media (max-width: 1700px) { display: none }` 藏起来，避免压正文。所以 frontmatter 写了
  `toc: true` 在 1280px 这类常见视口下也看不到目录，**不是 bug**。写断言 TOC 的测试必须显式给
  >1700px 视口（见 `e2e/i18n-preferences.spec.mjs` 的 S8）。
- **落款时间不会自动生成**：`datetime` 只来自 frontmatter（`Layout.tsx` 直接传 `fm.datetime`），
  view 与导出都不注入当前时间——不写就没有时间。构建期 `define` 注入的只有版本与许可证
  （`src/cli/vite-config.mjs`）。唯一取当前时间的地方是版权年份 `© {当前年份}`，在浏览器渲染时计算。
- **组件 children 里的裸 `{}` / `<`** 会被 MDX 当 JS 表达式 / JSX 解析而报错。要放字面量
  （如 `<Code>` 里的 JSON、含泛型的代码），用 `` {`...`} `` 模板字符串表达式，或改用 Markdown 围栏。
- **默认工作分支是 `dev`**：`main` 用于发布；不要直接往 `main` 提交。

## 术语表

- **MDX**：Markdown + JSX 组件的文档格式；本项目用官方 MDX v3 编译。
- **frontmatter**：文档顶部 `--- ... ---` 的 YAML 元信息，驱动主题与模板骨架。
- **三车道**：dot / mermaid / svg 三种围栏图的分派策略。
- **落款（Colophon）**：页面底部由 frontmatter 驱动的文档信息（`author` · `datetime` ·
  `copyright`，均可选、提供才显示）；`datetime` 格式为 `yyyy-MM-dd HH:mm:ss`，版权由模板渲染为
  `© 当前年份 {copyright}`。下方固定显示项目仓库、版本与许可证推广链接。
- **虚拟模块**：`virtual:mdx-target` / `virtual:mdxv-config`，由 `src/cli/plugin.mjs` 提供。
- **文档族（document family）**：同级同名、仅 locale 后缀不同的一组文档
  （`guide.mdx` / `guide.zh-CN.mdx` / `guide.en-US.mdx`），在导航里折叠为一个逻辑条目。
- **偏好（preferences）**：语言与 `auto/light/dark` 三态主题的用户手动选择，存 LocalStorage，
  由 `src/app/preferences.mjs`（纯逻辑）+ `PreferencesProvider.tsx`（Context）承载。
- **产品文案 vs 作者内容**：`src/i18n/messages.mjs` 只放产品界面字符串；作者写在 MDX 里的内容
  永不进入该目录，也不参与翻译。
