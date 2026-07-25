#!/usr/bin/env bash
#
# publish.sh — 发布 mdx-viewer 到 npmjs 官方源的门控脚本。
#
# 职责：版本核验 → 门控检查（干净工作树 / 分支 / 重复发布 / 测试）→ 读取 .env
#       中的 NPM_ACCESS_TOKEN（免 OTP 的 granular token）→ 强制官方源发布 →
#       打 v<version> tag。token 只在临时 npmrc 中出现，脚本退出即删，不打印。
#
# 用法（一般经 `make publish` 调用）：
#   scripts/publish.sh
#
# 开关（环境变量，传 1 生效）：
#   DRY_RUN=1      走 `npm publish --dry-run`，不真正发布、不打 tag
#   SKIP_TESTS=1   跳过发布前的 `npm test`（不建议，仅救急）
#   ALLOW_DIRTY=1  允许工作树有未提交改动时发布
#   SKIP_TAG=1     发布成功后不创建 / 推送 git tag
#
# token 来源优先级：已存在的环境变量 NPM_ACCESS_TOKEN > 仓库根 .env 里的同名项。

set -euo pipefail

# ---- 常量 ----
readonly REGISTRY="https://registry.npmjs.org"
readonly PKG_NAME="mdx-viewer"

# ---- 彩色输出（无 TTY 时自动降级为无色）----
if [ -t 1 ]; then
  C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_CYAN=$'\033[36m'; C_RESET=$'\033[0m'
else
  C_BOLD=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_CYAN=""; C_RESET=""
fi

step() { printf "\n%s▸ %s%s\n" "$C_CYAN$C_BOLD" "$*" "$C_RESET"; }
ok()   { printf "  %s✓%s %s\n" "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf "  %s!%s %s\n" "$C_YELLOW" "$C_RESET" "$*"; }
die()  { printf "\n%s✗ %s%s\n" "$C_RED$C_BOLD" "$*" "$C_RESET" >&2; exit 1; }

# 布尔开关：仅当值恰为 "1" 时为真
is_on() { [ "${1:-}" = "1" ]; }

# ---- 定位仓库根（脚本位于 <root>/scripts/）----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

[ -f package.json ] || die "未在仓库根找到 package.json（cwd=$ROOT_DIR）"
command -v node >/dev/null || die "缺少 node"
command -v npm  >/dev/null || die "缺少 npm"

printf "%s%s 发布门控%s  %s(root: %s)%s\n" \
  "$C_BOLD" "$PKG_NAME" "$C_RESET" "$C_DIM" "$ROOT_DIR" "$C_RESET"
is_on "${DRY_RUN:-}" && warn "DRY_RUN 模式：不会真正发布，也不会打 tag"

# ---- 1. 读取并校验版本号 ----
step "校验版本号"
VERSION="$(node -p "require('./package.json').version")"
[ -n "$VERSION" ] || die "无法从 package.json 读取 version"
# 语义化版本（含可选 -prerelease / +build）
SEMVER_RE='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$'
[[ "$VERSION" =~ $SEMVER_RE ]] || die "版本号 '$VERSION' 不是合法 semver"
ok "package.json version = $VERSION"

# 该版本是否已发布（防止 E403 覆盖发布）。npm view 命中官方源即视为已存在。
PUBLISHED="$(npm view "${PKG_NAME}@${VERSION}" version --registry "$REGISTRY" 2>/dev/null || true)"
if [ -n "$PUBLISHED" ]; then
  die "$PKG_NAME@$VERSION 已在 npm 上存在，无法重复发布 —— 请先 bump 版本号"
fi
ok "$PKG_NAME@$VERSION 尚未发布，可发布"

# ---- 2. Git 门控 ----
step "Git 状态门控"
if git rev-parse --git-dir >/dev/null 2>&1; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  [ "$BRANCH" = "main" ] && ok "分支 = main" || warn "当前分支为 '$BRANCH'（非 main）"

  if [ -n "$(git status --porcelain)" ]; then
    if is_on "${ALLOW_DIRTY:-}"; then
      warn "工作树有未提交改动（ALLOW_DIRTY=1，放行）"
    else
      die "工作树有未提交改动；请先提交或设 ALLOW_DIRTY=1"
    fi
  else
    ok "工作树干净"
  fi

  TAG="v${VERSION}"
  if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
    warn "tag ${TAG} 已存在（发布后将跳过创建）"
  fi
else
  warn "不是 git 仓库，跳过 git 门控"
fi

# ---- 3. 测试门控 ----
step "测试门控"
if is_on "${SKIP_TESTS:-}"; then
  warn "SKIP_TESTS=1：跳过 npm test（不建议）"
else
  npm test
  ok "测试通过"
fi

# ---- 4. 发布内容预览 ----
step "发布内容预览（npm pack --dry-run）"
npm pack --dry-run 2>&1 | grep -E 'npm notice (total files|package size|unpacked size|name|version):' || true

# ---- 5. 读取 token（不打印值）----
step "读取 NPM_ACCESS_TOKEN"
TOKEN="${NPM_ACCESS_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f .env ]; then
  # 只取所需变量，不 source 整个 .env（避免执行任意内容）；去掉首尾引号
  TOKEN="$(grep -E '^[[:space:]]*NPM_ACCESS_TOKEN=' .env | tail -n1 \
    | sed -E 's/^[[:space:]]*NPM_ACCESS_TOKEN=//; s/^["'"'"']//; s/["'"'"']$//')"
  [ -n "$TOKEN" ] && ok "从 .env 读取到 token（${#TOKEN} 字符）"
elif [ -n "$TOKEN" ]; then
  ok "使用环境变量中的 token（${#TOKEN} 字符）"
fi
[ -n "$TOKEN" ] || die "未找到 NPM_ACCESS_TOKEN（环境变量或 .env 均无）"

# ---- 6. 临时 npmrc（退出即删，权限 600，不落进仓库）----
NPMRC="$(mktemp -t mdxv-npmrc.XXXXXX)"
cleanup() { rm -f "$NPMRC"; }
trap cleanup EXIT
chmod 600 "$NPMRC"
{
  printf 'registry=%s\n' "$REGISTRY"
  printf '//registry.npmjs.org/:_authToken=%s\n' "$TOKEN"
} > "$NPMRC"

# ---- 7. 发布 ----
step "发布到 $REGISTRY"
PUBLISH_ARGS=(publish --userconfig "$NPMRC" --registry "$REGISTRY" --access public)
is_on "${DRY_RUN:-}" && PUBLISH_ARGS+=(--dry-run)

if npm "${PUBLISH_ARGS[@]}"; then
  if is_on "${DRY_RUN:-}"; then
    printf "\n%s✓ DRY_RUN 完成：未真正发布%s\n" "$C_GREEN$C_BOLD" "$C_RESET"
    exit 0
  fi
  printf "\n%s✓ 已发布 %s@%s%s\n" "$C_GREEN$C_BOLD" "$PKG_NAME" "$VERSION" "$C_RESET"
else
  die "npm publish 失败"
fi

# ---- 8. 打 tag ----
if git rev-parse --git-dir >/dev/null 2>&1 && ! is_on "${SKIP_TAG:-}"; then
  step "创建并推送 tag v${VERSION}"
  if git rev-parse -q --verify "refs/tags/v${VERSION}" >/dev/null; then
    warn "tag v${VERSION} 已存在，跳过创建"
  else
    git tag -a "v${VERSION}" -m "release: v${VERSION}"
    ok "已创建本地 tag v${VERSION}"
    if git push origin "v${VERSION}"; then
      ok "已推送 tag 到 origin"
    else
      warn "tag 推送失败，可稍后手动：git push origin v${VERSION}"
    fi
  fi
fi

printf "\n%s全部完成。%s\n" "$C_BOLD" "$C_RESET"
