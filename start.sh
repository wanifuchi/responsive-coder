#!/bin/bash

# サーバーを起動
echo "Starting server..."
cd server && npm run dev &

# フロントエンドを起動
echo "Starting frontend..."
cd .. && npm run dev &

echo "両方のサーバーが起動しました。"
echo "フロントエンド: http://localhost:5173"
echo "サーバー: http://localhost:3001"
echo ""
echo "停止するには Ctrl+C を押してください"

# 待機
wait