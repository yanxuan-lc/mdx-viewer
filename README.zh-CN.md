# mdx-viewer

[English](./README.md) · **简体中文**

本地 MDX 渲染器。`mdxv <file|dir>` 起浏览器预览,`mdxx <file>` 导出自包含离线 HTML。
基于官方 `@mdx-js` + Vite + React —— **官方 MDX 语法 100% 兼容**,组件可扩展。

## 定位与目标

- **一条命令看 MDX**:把 `.mdx` / `.md` 当文档来读,不必先搭 Next.js / Docusaurus 之类的站点工程。
- **官方标准为红线**:底座即官方参考实现 `@mdx-js/rollup`(MDX v3),CommonMark + JSX + `{}`
  表达式 + ESM `import`/`export` 全按官方标准解析;官方推荐的扩展(GFM / frontmatter / 数学 /
  代码高亮)按原版接入。改编译管线时以「不破坏官方兼容」为准则。
- **一套模板,语义化组件**:内置一套 CSS 变量驱动的 HTML+CSS 模板与语义组件(Hero / Callout /
  Steps…),作者写 `<Callout>` 无需 import;要扩展只需加一个组件 + 一行映射。
- **导出即离线**:`mdxx` 产出零外链单文件 HTML,KaTeX 字体、用到的 Mermaid 运行时全部
  base64 内联,双击即开、可随邮件/附件分发。

## 安装

### 从 npm 安装(推荐)

```bash
npm install -g mdx-viewer   # 全局安装,提供 mdxv(预览)与 mdxx(导出)
mdxv demo                   # 打开内置组件总览示例
```

或不安装、一次性运行:

```bash
npx -p mdx-viewer mdxv doc.mdx    # 预览
npx -p mdx-viewer mdxx doc.mdx    # 导出自包含 HTML
```

### 从源码安装

```bash
make install       # 装依赖(= npm install)
make link          # 可选:全局注册 mdxv / mdxx 命令
```

> 统一入口是 `make`:直接运行 `make` 查看全部命令。也可绕过 Makefile 直接用 `npm` / `mdxv` / `mdxx`。

用 make 快速上手:

```bash
make demo                             # 打开内置组件总览示例
make view FILE=doc.mdx                # 预览(FILE 可为文件或目录)
make view FILE=./docs ARGS="--port 5000"
make export FILE=doc.mdx OUT=out.html # 导出自包含 HTML
```

## 用法

```bash
mdxv demo              # 打开随包内置的组件总览示例(覆盖全部组件与参数)
mdxv doc.mdx           # 以文件所在目录为根,默认打开该文件(改文件自动热更新)
mdxv ./docs            # 以该目录为根,默认打开首篇(优先 README/index)
mdxv doc.mdx --port 5000 --host --no-open
mdxv doc.mdx --lang zh-CN
mdxv --check doc.mdx   # 只校验能否编译,不起服务:退出码 0 全通过 / 1 有文档失败 / 2 无法执行校验
mdxv --check ./docs    # 校验目录下每篇 .md/.mdx,逐条报告
mdxx doc.mdx           # 导出 doc.html(自包含、零外链、双击即开)
mdxx doc.mdx out.html  # 指定输出路径
mdxx doc.mdx --lang en-US # 指定导出页面的初始界面语言
```

`mdxv` 的行为是**统一**的:无论给文件还是目录,都以一个根目录运作——给文件则根为其所在目录、
默认打开该文件;给目录则根为该目录、默认打开首篇。当根目录下有多篇 `.md`/`.mdx` 时显示左侧
导航并支持相对链接互跳;只有一篇时不显示导航。想快速看全部组件长什么样,直接 `mdxv demo`。

把文档交给别人之前,先跑 `mdxv --check`。它是**编译**校验,所以通过意味着这篇文档**打得开**,
不意味着它是对的:未定义组件、非法属性值、畸形数学都检不出(这些能加载但渲染不对),任何顶层
ESM 语句或 `{…}` 表达式在模块求值 / 渲染期失败也检不出(这些会让文档根本加载不出来)。这些只是
例子,不是清单。围栏代码块里的 `import` 是纯文本,所以写文档讲 JavaScript 完全不受影响。

浏览器界面支持简体中文和英文，初始语言跟随浏览器；CLI 依次读取 `--lang`、`MDXV_LANG`、
系统 Locale。工具栏的语言按钮与 `自动 → 浅色 → 深色` 三态主题按钮会把手动选择保存到
LocalStorage；主题处于自动模式时，会继续响应操作系统配色变化。

## 本地化文档变体

目录预览可将一个无后缀文档与可选的简体中文、英文变体归为同一文档族。把 locale 放在扩展名之前：

```text
guide.mdx          # 无后缀基础回退文件
guide.zh-CN.mdx    # 简体中文变体
guide.en-US.mdx       # 英文变体
```

当前界面语言优先选择精确 locale 变体，缺失时才回退到无后缀基础文件。导航只显示一个逻辑上的
`guide.mdx`，不会为每个物理变体重复显示。直接打开本地化的 `?doc=` URL 仍然有效；当同族存在
当前语言或基础回退文件时，预览会规范化为该物理文件。Markdown 相对链接也按同一文档族规则本地化。
只有精确的 `.zh-CN` 和 `.en-US` 后缀有此语义，其他带点文件名仍是普通文件名。`mdxx <file>` 始终只导出
传入的物理文件，不会选择或打包同级变体。

## 与官方 MDX 的关系

底座是官方参考实现 `@mdx-js/rollup`(MDX v3),所以 **CommonMark + JSX + `{}` 表达式 + ESM `import`/`export`** 全部按官方标准解析。官方推荐的扩展也都按原版接上:

| 能力 | 实现 | 写法 |
|---|---|---|
| GFM(表格/任务清单/删除线) | `remark-gfm` | 原生 Markdown |
| Frontmatter(完整 YAML) | `remark-frontmatter` + `remark-mdx-frontmatter` | `--- ... ---`,并导出 `frontmatter` |
| 数学 | `remark-math` + `rehype-katex` | 官方 `$...$` / `$$...$$`(另有 `<Math tex=…>` 扩展) |
| 代码高亮 | `rehype-pretty-code`(Shiki) | ```` ```ts ```` 双主题随明暗 |

在此之上扩展自己的组件(见下)。

## 自定义组件

通过 `MDXProvider` 注入,作者写 `<Callout>` 等**无需 import**:

`Hero` `Section` `Callout` `Card` `Columns` `Toggle` `Steps`/`Step` `Stats`/`Stat`
`Fields`/`Field` `Scenario`/`When`/`And`/`Then` `Grid`/`Item`(可筛选) `Badge` `Figure`
`Math` `Code` `Footer` `Colophon`。样式只用语义参数(`tone`/`ratio`/`status`),不写颜色值。

**扩展新组件(OCP)**:在 `src/app/components/blocks.tsx` 写一个 React 组件,在
`src/app/mdx-components.tsx` 的映射表加一行即可,核心渲染管线无需改动。

## 图(Diagram)

用 fenced code block 承载,围栏语言分三车道:

| 围栏 | 引擎 | 运行时 |
|---|---|---|
| `dot` / `graphviz` | 构建期 Graphviz(wasm) → 静态 SVG | 零运行时 |
| `mermaid` | 客户端渲染,主题跟随明暗 | 用到才载入 |
| `svg` | 原样内联 | 零运行时 |

每张图悬停会出现放大按钮,点击进入**全屏预览**:光标锚定滚轮缩放、拖拽平移、缩放/适配/关闭
工具栏,Esc 或点遮罩退出。缩放改的是 SVG 固有尺寸而非 CSS transform,任意倍率都保持矢量清晰。
`mdxv` 预览与 `mdxx` 导出产物中都可用。

## Frontmatter 字段

所有字段均为可选,提供才渲染。

`title` `eyebrow` `subtitle` `author` `org` `copyright` `datetime`（`yyyy-MM-dd HH:mm:ss`）`footer`
`palette`(indigo/teal/rose/amber/lime) `mode`(light/dark/auto —— 只是**初始**主题,工具栏按钮
可覆盖并持久化) `density`(comfortable/compact) `toc`(设 `true` 才显示)
`hero`(false 关自动 Hero) `chrome`(off 关头尾+落款)。

`toc: true` 渲染右侧固定目录,但它在**视口窄于 1700px 时会隐藏**以免压住正文——普通笔记本屏幕上
看不到是正常的。

`datetime` 不会自动生成:落款显示的就是 frontmatter 里写的值,预览与导出都一样。只有版权年份
（`© <年份>`）取自当前日期。

## 目录结构

```
bin/          mdxv.mjs(预览)· mdxx.mjs(导出)
src/
  cli/        入参解析 · Vite 配置 · 虚拟模块插件 ·
              CLI 语言判定 · 文档语言变体 · 终端输出
  mdx/        编译插件清单 · 图三车道 rehype 插件
  i18n/       支持的 locale · 产品文案目录(只放产品字符串)
  app/        React 应用:Layout · 组件库 · theme.css ·
              MDXProvider 映射 · 偏好(语言 / 主题)
demo/         index.mdx · index.zh-CN.mdx —— 随包组件总览示例
examples/     demo.mdx · guide/intro.md
test/         node --test 测试(单元 / 集成 / 导出冒烟)
e2e/          Playwright spec + fixtures
```

## 架构要点

- **view**:`mdxv` 程序化启动 Vite dev server。单篇经虚拟模块 `virtual:mdx-target`
  加载;目录模式扫描 `.md`/`.mdx` 提供 `/__mdxv/tree`,前端按 `?doc=` 加载并路由相对链接。
- **build**:`mdxx` 走 `vite build` + `vite-plugin-singlefile`,资源(含 KaTeX 字体、
  用到的 Mermaid 运行时)全部 base64 内联,产出零外链单文件 HTML。

## 测试

`test/` 用 Node 内置 `node --test` —— **零第三方测试依赖**;界面行为放在 `e2e/`,由 Playwright
驱动(唯一的 devDependency)。

```bash
make test          # 全部 node 测试(单元 + 集成 + 导出冒烟,不含 e2e)
make test-unit     # 快:纯逻辑 + MDX 编译管线(无 vite 构建)
make test-cli      # CLI 子进程契约,不跑 vite 构建
make test-build    # 需要真实 vite 构建的(最慢)
make test-e2e      # Playwright 端到端(首次需 npx playwright install)
```

- **单元** —— 入参解析、文档语言变体、locale 与文案取词、CLI 语言优先级、终端输出格式化、
  本地文档链接解析;fixture 在临时目录现建现清。
- **集成** —— 用官方 `@mdx-js/mdx` 的 `compile()` 跑 `mdxOptions()`,断言 frontmatter / GFM / 数学 / 高亮 / 图三车道均生效。
- **导出冒烟** —— 跑真实 `mdxx`,断言产物零外链、base64 内联。
- **e2e** —— 语言 / 主题偏好及其持久化、本地化文档变体、空态与错误态。

## 环境要求

Node ≥ 20(ESM)。CLI 侧为纯 `.mjs`,Node 直接执行,无编译步骤;浏览器应用为 `.tsx`,由
Vite 转译,无独立 tsc 步骤。

## 如何贡献

本项目的开发**完全基于 VibeCoding**：所有落地代码都由 AI Agent 依据一份已提交的 spec 写成，经人类
审查，跑在 [ExcaliVibe](https://github.com/yanxuan-lc/excalivibe) 能力套件上。每个非平凡变更都连同
它的 `openspec/changes/<id>/` 留痕一起落地，因此「需求是什么、决策是什么、哪些门禁过了」始终可审。

不跑 Agent 也能参与——一个说清楚的 issue 就是一等贡献，因为流程正是从这份 brief 开始的。
[CONTRIBUTING.zh-CN.md](./CONTRIBUTING.zh-CN.md) 讲清了环境准备、研发闭环、项目红线（官方 MDX
兼容、零外链导出）以及提 PR 前应有的验证。

## 变更日志

[CHANGELOG.md](./CHANGELOG.md) 是发布索引，每条都链到对应的 GitHub Release 看完整说明。**会改变
已有文档渲染结果的发布会明确写出来**——0.3.0 的「what you may notice」就是这类提示的样子。
（该文件与 Release 说明只用英文一份：详细叙述在 Release 里，再维护一份中文副本必然漂移，
而本项目刚因为文档漂移吃过教训。）

## 许可证

[MIT](./LICENSE) © yanxuan-lc
