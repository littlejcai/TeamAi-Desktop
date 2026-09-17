#!/usr/bin/env bash
# 同步 fork（teamai-cli）main 到上游最新，并提示主仓库更新依赖指纹。
# 用法: bash scripts/sync-upstream.sh [upstream ref，缺省 upstream/main]
# 约定：fork 开发克隆位于主仓库同级目录（D:\Project\teamai-cli），或用 TEAMAI_FORK_DIR 指定。
set -euo pipefail

DEFAULT_FORK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/teamai-cli"
FORK_DIR="${TEAMAI_FORK_DIR:-$DEFAULT_FORK}"
REF="${1:-upstream/main}"

# 仅接受常规 ref 名，拒绝以 - 开头的参数（防 git 选项注入）
if ! printf '%s' "$REF" | grep -qE '^([0-9a-fA-F]{40}|[0-9A-Za-z][0-9A-Za-z._/-]{0,63})$'; then
  echo "非法的 ref 参数: $REF" >&2
  exit 1
fi

if [ ! -d "$FORK_DIR/.git" ]; then
  echo "未找到 fork 开发克隆: $FORK_DIR" >&2
  echo "请先: git clone https://github.com/littlejcai/teamai-cli.git（主仓库之外）" >&2
  exit 1
fi

echo ">> 在 $FORK_DIR 拉取上游 ..."
git -C "$FORK_DIR" fetch upstream
git -C "$FORK_DIR" checkout main
echo ">> rebase 基础设施提交到 $REF ..."
git -C "$FORK_DIR" rebase "$REF"
git -C "$FORK_DIR" push origin main
NEW="$(git -C "$FORK_DIR" rev-parse HEAD)"

echo ">> fork main 已同步并推送: $NEW"
echo ">> 接下来在主仓库："
echo "   1) 更新 package.json: dependencies.teamai-cli -> github:littlejcai/teamai-cli#$NEW"
echo "      （desktop-json 分支建立后，指纹指向该分支的 rebase 后提交）"
echo "   2) pnpm install"
echo "   3) 提交主仓库（含 docs/CORE.md 的锁定 commit 表）"
