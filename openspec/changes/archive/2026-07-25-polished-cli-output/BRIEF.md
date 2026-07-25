# Brief — polished-cli-output

## Goal

统一优化 `mdxv` 与 `mdxx` 的终端输出：错误参数可立即看到符合常见 Linux CLI
习惯的帮助页，成功输出具备清晰层级、标签、颜色与操作提示。

## Done

- `--help` 使用 `Usage:`、`Arguments:`、`Options:` 分区，不暴露 `cac` 的 Commands 样式。
- 参数解析失败时先显示具体错误，再显示对应命令的完整帮助，退出码为 1 且无堆栈。
- `mdxv` 启动后显示版本、根目录、默认文档、文档数、访问链接和 `Ctrl+C` 停止提示。
- `mdxx` 导出后显示版本、源文件、输出文件、文件大小与打开提示。
- 仅 TTY 且未设置 `NO_COLOR` 时输出 ANSI 色彩；重定向及测试输出保持纯文本。
- 中英文消息目录键集继续一致，现有 CLI、MDX 与导出测试无回归。

