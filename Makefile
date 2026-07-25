.DEFAULT_GOAL := help

# 主 Makefile 路径（供 help 精确 grep 自身）
MK := $(firstword $(MAKEFILE_LIST))

# view / export 的默认目标文档，可用 FILE= 覆盖；ARGS= 透传额外参数（如 --port 5000）
FILE ?= examples/demo.mdx
ARGS ?=

.PHONY: help install link demo view export test test-unit test-export publish publish-dry clean

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

## ---- test ----
test: install ## 跑全部测试（单元 + 集成 + 导出冒烟）
	npm test

test-unit: install ## 只跑单元 + 集成（快，无 vite 构建）
	npm run test:unit

test-export: install ## 只跑导出自包含冒烟（含 vite 构建，较慢）
	npm run test:export

## ---- release ----
publish: install ## 发布到 npmjs（版本核验 + 门控 + 读 .env token）
	./scripts/publish.sh

publish-dry: install ## 发布演练（npm publish --dry-run，不真正发布/打 tag）
	DRY_RUN=1 ./scripts/publish.sh

## ---- maintain ----
clean: ## 删除 node_modules 与导出的 .html 产物（不含 examples/demo 源码）
	rm -rf node_modules
	find examples demo -name '*.html' -delete 2>/dev/null || true

help: ## 列出所有可用命令（按职责分组）
	@printf "\n\033[1mmdx-viewer — make targets\033[0m\n"
	@for group in general run test release maintain; do \
		case "$$group" in \
			general)  title="general  — 安装 / 注册"; \
			          pat="^(help|install|link):" ;; \
			run)      title="run      — 预览 / 导出"; \
			          pat="^(demo|view|export):" ;; \
			test)     title="test     — 测试"; \
			          pat="^(test|test-unit|test-export):" ;; \
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
