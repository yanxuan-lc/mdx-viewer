## Why

当前帮助页带有框架生成的命令结构，参数错误只输出笼统诊断；成功状态则是一组无层级的文本，
用户难以快速识别目录、文件、链接和下一步操作。

## What Changes

- 新增共享 CLI 呈现模块，负责帮助页、错误页、TTY 色彩和对齐面板。
- `mdxv` 与 `mdxx` 使用同一套输出规则。
- 扩展双语消息目录，并增加子进程与纯函数测试。

## Impact

修改 `bin/mdxv.mjs`、`bin/mdxx.mjs`、`src/i18n/messages.mjs`；新增
`src/cli/output.mjs` 与 `test/cli-output.test.mjs`。不改变 MDX 编译、HTTP 接口、数据库或导出格式。

