## Why

mdx-viewer 的固定产品文案目前主要为简体中文，主题切换也不会跨刷新保留；这使英文用户、希望跟随系统明暗的用户，以及离线导出文档的接收者获得不一致的体验。该变更为 CLI、浏览器预览和单文件导出建立同一套双语与偏好解析规则，同时保持 MDX 正文和官方编译兼容基线不变。

## What Changes

- 为 `mdxv`、`mdxx` 增加 `--lang zh-CN|en`，并按 `--lang`、`MDXV_LANG`、系统语言、英文的顺序解析 CLI 语言。
- 为浏览器固定产品文案提供 `zh-CN` 与 `en` 两份完整消息目录，并同步更新 `<html lang>`。
- 在工具栏增加语言切换，在主题控件中支持 `auto`、`light`、`dark` 三态循环。
- 用 LocalStorage 持久化合法的语言与主题偏好；缺失、损坏或不可访问时按确定性规则回退。
- 把 CLI 选定语言及其来源通过既有虚拟模块注入预览与导出页面。
- 保持 `mdxx` 产物自包含、零外链、离线可用，并让导出页面保留语言/主题交互。
- 增加纯逻辑、CLI、浏览器交互与导出层的脚本化验收覆盖。

## Capabilities

### New Capabilities

- `i18n-preferences`: CLI 与浏览器的双语消息、语言/主题偏好解析、持久化和导出行为。

### Modified Capabilities

无；仓库当前没有已登记的 OpenSpec 主规格。

## Impact

- 受影响入口：`bin/mdxv.mjs`、`bin/mdxx.mjs`。
- 受影响模块：CLI 入参/错误边界、Vite 配置与 `virtual:mdxv-config`、React 模板骨架、Grid 默认筛选项、落款固定措辞和主题样式。
- 新增内部模块：共享语言消息与规范化、CLI 语言解析、浏览器偏好解析/上下文。
- 测试影响：保留现有 `node:test` 与真实 Vite 导出冒烟；浏览器状态流使用脚本化浏览器测试。
- 不新增远程服务、第三方 i18n 框架、数据库、CDN 或资源外链；不自动翻译作者提供的 MDX/frontmatter/组件文本。
