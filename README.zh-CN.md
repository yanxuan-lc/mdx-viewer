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
mdxx doc.mdx           # 导出 doc.html(自包含、零外链、双击即开)
mdxx doc.mdx out.html  # 指定输出路径
mdxx doc.mdx --lang en-US # 指定导出页面的初始界面语言
```

`mdxv` 的行为是**统一**的:无论给文件还是目录,都以一个根目录运作——给文件则根为其所在目录、
默认打开该文件;给目录则根为该目录、默认打开首篇。当根目录下有多篇 `.md`/`.mdx` 时显示左侧
导航并支持相对链接互跳;只有一篇时不显示导航。想快速看全部组件长什么样,直接 `mdxv demo`。

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
`Math` `Code`。样式只用语义参数(`tone`/`ratio`/`status`),不写颜色值。

**扩展新组件(OCP)**:在 `src/app/components/blocks.tsx` 写一个 React 组件,在
`src/app/mdx-components.tsx` 的映射表加一行即可,核心渲染管线无需改动。

## 图(Diagram)

用 fenced code block 承载,围栏语言分三车道:

| 围栏 | 引擎 | 运行时 |
|---|---|---|
| `dot` / `graphviz` | 构建期 Graphviz(wasm) → 静态 SVG | 零运行时 |
| `mermaid` | 客户端渲染,主题跟随明暗 | 用到才载入 |
| `svg` | 原样内联 | 零运行时 |

## Frontmatter 字段

`title` `subtitle` `author`(必填) `org` `copyright` `datetime`（`yyyy-MM-dd HH:mm:ss`）`footer`
`palette`(indigo/teal/rose/amber/lime) `mode`(light/dark/auto) `density`(comfortable/compact)
`toc` `hero`(false 关自动 Hero) `chrome`(off 关头尾+落款)。

## 目录结构

```
bin/          mdxv.mjs(预览)· mdxx.mjs(导出)
src/
  cli/        入参解析 · Vite 配置 · 虚拟模块插件
  mdx/        编译插件清单 · 图三车道 rehype 插件
  app/        React 应用:Layout · 组件库 · theme.css · MDXProvider 映射
examples/     demo.mdx · guide/intro.md
```

## 架构要点

- **view**:`mdxv` 程序化启动 Vite dev server。单篇经虚拟模块 `virtual:mdx-target`
  加载;目录模式扫描 `.md`/`.mdx` 提供 `/__mdxv/tree`,前端按 `?doc=` 加载并路由相对链接。
- **build**:`mdxx` 走 `vite build` + `vite-plugin-singlefile`,资源(含 KaTeX 字体、
  用到的 Mermaid 运行时)全部 base64 内联,产出零外链单文件 HTML。

## 测试

用 Node 内置 `node --test` —— **零第三方测试依赖**。`test/` 下三层:

```bash
make test          # 全部(单元 + 集成 + 导出冒烟)
make test-unit     # 快:纯逻辑 + MDX 编译管线(无 vite 构建)
make test-export   # 导出自包含冒烟(真实 vite 构建,约 7s)
```

- **单元** —— `src/cli/resolve.mjs`(`resolveInput` / `scanTree` / `pickDefaultDoc`),fixture 在临时目录现建现清。
- **集成** —— 用官方 `@mdx-js/mdx` 的 `compile()` 跑 `mdxOptions()`,断言 frontmatter / GFM / 数学 / 高亮 / 图三车道均生效。
- **导出冒烟** —— 跑真实 `mdxx`,断言产物零外链、base64 内联。

## 环境要求

Node ≥ 20(ESM)。CLI 侧为纯 `.mjs`,Node 直接执行,无编译步骤;浏览器应用为 `.tsx`,由
Vite 转译,无独立 tsc 步骤。

## 许可证

[MIT](./LICENSE) © yanxuan-lc
