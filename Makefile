.DEFAULT_GOAL := help

# 主 Makefile 路径（供 help 精确 grep 自身）
MK := $(firstword $(MAKEFILE_LIST))

# view / export 的默认目标文档，可用 FILE= 覆盖；ARGS= 透传额外参数（如 --port 5000）
FILE ?= examples/demo.mdx
ARGS ?=

# lint 扫描的 .mjs 源目录（用 find 而非 git ls-files：未跟踪的新文件也要检出来）
LINT_DIRS := bin src scripts test e2e

.PHONY: help install link demo view export check-mdx lint test test-unit test-cli test-build test-e2e publish publish-dry clean

## ---- general ----
install: ## 安装依赖（首次）
	npm install

link: install ## 全局注册 mdxv / mdxx 命令
	npm link

## ---- run ----
demo: install ## 打开随包内置的组件总览示例（mdxv demo）
	node bin/mdxv.mjs demo $(ARGS)

view: install ## 预览 MDX：make view FILE=<file|dir> [ARGS="--port 5000"]
	node bin/mdxv.mjs $(FILE) $(ARGS)

export: install ## 导出自包含 HTML：make export FILE=<file> [OUT=out.html]
	node bin/mdxx.mjs $(FILE) $(OUT)

check-mdx: install ## 校验 MDX 能否编译：make check-mdx FILE=<file|dir>
	node bin/mdxv.mjs --check $(FILE) $(ARGS)

## ---- check ----
# 本项目无 eslint/prettier/biome，也无 tsc（.tsx 由 Vite 的 esbuild 直接剥类型）。
# lint 因此由项目自带的两件真检查组成，零新增依赖，且都会真失败：
#   1. node --check：全部 .mjs 的语法解析（含未被任何测试 import 的脚本，如 scripts/）
#   2. mdxv --check：随包 MDX 文档能否按官方管线编译——即本仓库的头号红线
lint: install ## 静态检查：.mjs 语法解析 + 随包 MDX 编译校验（无新增依赖）
	@printf "\033[1m→ node --check\033[0m\n"
	@find $(LINT_DIRS) -name '*.mjs' -print0 | xargs -0 -n1 node --check
	@printf "  %s files parsed\n" "$$(find $(LINT_DIRS) -name '*.mjs' | wc -l | tr -d ' ')"
	@printf "\033[1m→ sh -n\033[0m\n"
	@for f in scripts/*.sh; do sh -n "$$f" && printf "  ✓ %s\n" "$$f"; done
	@printf "\033[1m→ mdxv --check\033[0m\n"
	node bin/mdxv.mjs --check examples
	node bin/mdxv.mjs --check demo

## ---- test ----
# 车道按**依赖表面**分，不按耗时——耗时是结果，依赖表面是可 grep、不会漂的判据：
#   L1 test-unit   进程内 import src/，零 spawn
#   L2 test-cli    spawn bin/ 子进程断 stdout/exit code，不跑构建（dev server 算 L2）
#   L3 test-build  跑真实 Vite 构建
# `make test` 仍用 glob 收全部 test/*.test.mjs——门控承重的是「没有例外」，
# 新增测试文件自动进门控，不依赖谁记得改上面三条清单。
test: install ## 跑全部 node 测试（三条车道全收，不含 e2e）
	npm test

test-unit: install ## L1 只跑进程内单测（亚秒级，零子进程）
	npm run test:unit

test-cli: install ## L2 只跑 CLI 子进程契约（无 vite 构建）
	npm run test:cli

test-build: install ## L3 只跑需要真实 vite 构建的（最慢）
	npm run test:build

test-e2e: install ## 跑 Playwright 端到端（首次需 npx playwright install）
	npm run test:e2e

## ---- release ----
publish: install ## 发布到 npmjs（版本核验 + 门控 + 读 .env token）
	./scripts/publish.sh

# 演练的价值正是「合并进 main 之前先排练一遍」，所以豁免放在调用点：脚本里的分支门控
# 保持一句实话（非 main 一律拦停），而 publish-dry 显式声明自己不需要它。
publish-dry: install ## 发布演练（npm publish --dry-run，不真正发布/打 tag；可在 dev 上跑）
	ALLOW_NON_MAIN=1 DRY_RUN=1 ./scripts/publish.sh

## ---- maintain ----
clean: ## 删除 node_modules 与导出的 .html 产物（不含 examples/demo 源码）
	rm -rf node_modules
	find examples demo -name '*.html' -delete 2>/dev/null || true

help: ## 列出所有可用命令（按职责分组）
	@printf "\n\033[1mmdx-viewer — make targets\033[0m\n"
	@for group in general run check test release maintain; do \
		case "$$group" in \
			general)  title="general  — 安装 / 注册"; \
			          pat="^(help|install|link):" ;; \
			run)      title="run      — 预览 / 导出 / 校验"; \
			          pat="^(demo|view|export|check-mdx):" ;; \
			check)    title="check    — 静态检查"; \
			          pat="^lint:" ;; \
			test)     title="test     — 测试"; \
			          pat="^(test|test-unit|test-cli|test-build|test-e2e):" ;; \
			release)  title="release  — 发布"; \
			          pat="^(publish|publish-dry):" ;; \
			maintain) title="maintain — 清理"; \
			          pat="^clean:" ;; \
		esac; \
		printf "\n  \033[1;33m%s\033[0m\n" "$$title"; \
		printf "  \033[2m──────────────────────────────────────────────\033[0m\n"; \
		grep -E "$$pat.*## " $(MK) \
			| awk '{ name=$$0; sub(/:.*/,"",name); desc=$$0; sub(/^.*## /,"",desc); \
			         printf "    \033[36m%-10s\033[0m %s\n", name, desc }'; \
	done; \
	printf "\n  变量：\033[36mFILE\033[0m=预览/导出目标  \033[36mOUT\033[0m=导出路径  \033[36mARGS\033[0m=透传参数\n\n"
