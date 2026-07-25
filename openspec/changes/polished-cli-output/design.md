## Four Contracts

### 1. Project structure & module design

`src/cli/output.mjs` 是唯一终端呈现边界，导出 help、错误、预览成功和导出成功格式化函数。
格式化函数接收显式 `color` 参数并返回字符串，入口文件只负责写入 stderr/stdout。ANSI 辅助函数
和列宽计算保持模块私有。

### 2. External protocol / CLI contract

```text
mdxv [OPTIONS] <file|dir|demo>
mdxx [OPTIONS] <file> [output]
```

`-h, --help` 输出 `Usage:`、`Arguments:`、`Options:`。未知选项、缺失选项值、缺失必需输入
和多余位置参数输出 `Error: ...`（或本地化等价文本）、空行、完整帮助，退出 1。
`--version` 仍输出版本并退出 0。
成功摘要写 stderr，访问 URL 保持可复制的原始字符串。

### 3. Database design

不适用：无数据库、持久化、DDL 或迁移。

### 4. Use cases & scripted scenarios

- S1：两个入口执行 `--help`，输出标准分区和正确 usage，退出 0。
- S2：两个入口传入未知参数，输出诊断和完整 help，退出 1、无堆栈。
- S3：非 TTY 格式化预览/导出成功摘要，包含全部字段和操作提示且无 ANSI。
- S4：显式启用 color 时摘要含 ANSI；设置无色模式后输出保持纯文本。

执行载体为 `node:test`（纯格式化 + 子进程）；现有完整 `npm test` 作为兼容性载体。
