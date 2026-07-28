# HYPOTHESIS — 深色主题下图内文字不可见

诊断由控制器完成，结论**已实证**，不是推测。此文件代替 `debugger` 的 investigation 环节
（根因已定位，再派一次只是重新推导同样的事实）；`developer` 据此先写红测试再修。

## 症状

深色主题下 `dot` 图的框线变白（可见），**框里的文字仍是黑的**（不可见）。背景透明，所以黑字
直接消失在深色页面上。

## 根因（实测）

Graphviz 的 `<text>` **不写 `fill` 属性**：

```
$ Graphviz.load().dot('digraph { A [label="节点"] }')
<text xml:space="preserve" text-anchor="middle" x="27" y="-13.8"
      font-family="Times,serif" font-size="14.00">节点</text>
                                                  ↑ 无 fill
```

而 **SVG 规范里 `fill` 的初始值是 `black`**，不是 `currentColor`。所以：

| 元素 | Graphviz 输出 | `themeSvg` 处理后 | 深色下 |
|---|---|---|---|
| 节点描边 | `stroke="black"` | `stroke="currentColor"` | ✓ 可见 |
| 节点文字 | （无 fill） | （无可替换之物） | ✗ 取初始值 black → 不可见 |

`theme.css:352` 的 `.mv-diagram { color: var(--ink) }` 救不了它 —— 文字取的是 `fill` 初始值
`black`，而不是 `currentColor`，`color` 对它无影响。

## 第二个缺陷：`themeSvg` 是字符串 regex，认不全黑色写法

`src/mdx/diagrams.mjs:36-47` 只匹配三种字面写法（`stroke="black"` / `fill="black"` /
`fill="#000000"`）。实测 8 种真实写法**漏 6 种**（`svg` 车道同样走这个函数）：

| 写法 | 现状 |
|---|---|
| `fill="black"`、`fill="#000000"` | ✓ 转 `currentColor` |
| `fill="#000"` | ✗ 仍是黑 |
| `fill="rgb(0,0,0)"` | ✗ 仍是黑 |
| `stroke="#000"` | ✗ 仍是黑 |
| `stroke="#000000"` | ✗ 仍是黑 —— **注意 `fill="#000000"` 处理了而 `stroke` 没有，是疏漏** |
| `style="fill:black"` | ✗ 仍是黑（在 style 属性里，regex 看的是 fill 属性） |
| 完全不写 fill | ✗ 无可替换之物 → 默认黑（**本 bug 主因**） |

在字符串上用 regex 猜颜色写法永远补不全（还有 `hsl()`、`rgba()`、大小写、空格变体……）。

## 修复方向（含一处用户决策）

**用户已定：黑 → 前景色，白 → 背景色**，两者都当「语义色」处理。理由：Graphviz 节点默认带
`fill="white"`，深色下白底白字同样不可见；只改黑不改白会把 bug 换个形式留下。

建议实现层次：

1. **在 hast 层做**（`svgToHast` 已经把 SVG 变成树了），取代字符串 regex —— 在树上按属性判断
   颜色比在字符串上匹配稳得多，且 `dot` 与 `svg` 两条车道共用一处。
2. **颜色值仍归 `theme.css`**：hast 只打语义 class（前景/背景），CSS 定义实际颜色。这与本项目
   「语义 token 驱动、颜色集中在 theme.css」的既有约定一致，也让 `mdxx` 导出路径自动同样生效
   （导出会内联 theme.css）。可用 token：前景 `currentColor`（经 `.mv-diagram { color: var(--ink) }`
   解析）、背景 `var(--surface)`（浅 `#fffdf8` / 深 `#2d282b`）。
   注意：`fill="var(--x)"` 作为**表现属性**在各浏览器上不可靠，别走这条；用 class 或内联 style。
3. **CSS 优先级是这里的杠杆**：表现属性（presentation attribute）优先级**低于任何 CSS 规则**，
   所以样式表能盖掉 `fill="#000"` 而无需知道 SVG 里写了什么。内联 `style="fill:..."` 例外
   （需 `!important` 或在 hast 层改写）。

## 硬边界

- **别动作者故意设的颜色。** 只有「黑」「白」「未指定」算语义色；`fill="red"` 一律保留原样。
  这是作者的表达意图，改掉它是另一个 bug。
- **`mermaid` 车道不在本次范围**：它客户端渲染且已随明暗重渲（`Layout.tsx:97-123`）。
- `src/cli/vite-config.mjs` 零改动；`src/mdx/plugins.mjs` 仅在必要时改插件清单顺序（本次预期不需要）。
- 双端一致：`mdxv`(dev) 与 `mdxx`(导出) 两条路径行为必须相同。

## 验收必须包含浏览器核对

这是视觉缺陷，单测只能证明属性/class 落对了，**不能证明人眼看得见**。按 CLAUDE.md，改动图管线
后必须用浏览器工具在**深色**与**浅色**两种主题下各看一次。环境提示：`claude --chrome` 扩展当前
未连接（本会话两个 agent 都遇到），可用 chrome-devtools MCP；选框架前读 `plugin-infra:graceful-browser`。
