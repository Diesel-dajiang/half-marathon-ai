#!/usr/bin/env bash
# 一键本地部署「全自动推送」后端到 Cloudflare Pages：
#   0) 检查 wrangler 已登录
#   1) 构建前端
#   2) 创建 KV 命名空间（存跑步记录，重部署不清空）
#   3) 把 KV id 自动写回 wrangler.toml
#   4) 部署前端 + Pages Functions（KV 绑定随之生效）
#
# 前置（只需做一次）：npx wrangler login
set -e

echo "== 检查 Cloudflare 凭证 =="
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "⚠️ 未检测到 CLOUDFLARE_API_TOKEN 环境变量（当前为非交互环境，无法用 wrangler login 弹浏览器）。"
  echo "请先设置："
  echo "  export CLOUDFLARE_API_TOKEN=你的token"
  echo "  export CLOUDFLARE_ACCOUNT_ID=你的account_id"
  echo "（如需每次终端都生效，可把这两行加到 ~/.zshrc）"
  exit 1
fi
if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "⚠️ 已设置 CLOUDFLARE_API_TOKEN，但缺少 CLOUDFLARE_ACCOUNT_ID。请一并 export 后重试。"
  exit 1
fi

echo "== 构建前端 =="
npm run build

echo "== 创建 KV 命名空间 WORKOUTS =="
OUT=$(npx wrangler kv namespace create WORKOUTS)
echo "$OUT"

# 解析 wrangler 输出的 id = "xxxx"
ID=$(echo "$OUT" | grep -oE 'id\s*=\s*"[a-f0-9]+"' | grep -oE '"[a-f0-9]+"' | tr -d '"' | head -1)
if [ -z "$ID" ]; then
  echo "⚠️ 未能自动解析 KV id，请手动把上面输出的 id 填到 wrangler.toml 的 [[kv_namespaces]] id 字段，再运行：npm run deploy"
  exit 1
fi

echo "== 写入 wrangler.toml (id=$ID) =="
node -e "const fs=require('fs');let s=fs.readFileSync('wrangler.toml','utf8');s=s.replace(/id\s*=\s*\"[^\"]*\"/,'id = \"$ID\"');fs.writeFileSync('wrangler.toml',s);"

echo "== 部署到 Cloudflare Pages（项目名 half-marathon-ai）=="
npx wrangler pages deploy dist --project-name half-marathon-ai

echo "✅ 部署完成。把 https://<你的域名>/api/health-export 填进 Health Auto Export 或 iPhone 快捷指令，设为每天自动发送即可全自动同步。"
