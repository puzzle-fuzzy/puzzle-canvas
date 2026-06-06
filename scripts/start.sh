#!/bin/bash

# Puzzle Canvas 启动脚本
# 启动前自动清理旧端口进程

FRONTEND_PORT=5175
BACKEND_PORT=3001

echo "🧹 清理旧进程..."

# 关闭前端端口
PID=$(lsof -ti:$FRONTEND_PORT 2>/dev/null)
if [ -n "$PID" ]; then
  kill $PID 2>/dev/null
  echo "  已关闭端口 $FRONTEND_PORT (PID: $PID)"
else
  echo "  端口 $FRONTEND_PORT 无进程"
fi

# 关闭后端端口
PID=$(lsof -ti:$BACKEND_PORT 2>/dev/null)
if [ -n "$PID" ]; then
  kill $PID 2>/dev/null
  echo "  已关闭端口 $BACKEND_PORT (PID: $PID)"
else
  echo "  端口 $BACKEND_PORT 无进程"
fi

# 等待端口释放
sleep 1

echo ""
echo "🚀 启动服务..."

# 后台启动后端
bun run dev:server &
SERVER_PID=$!

# 后台启动前端
bun run dev &
FRONTEND_PID=$!

# 捕获 Ctrl+C 同时关闭两个进程
trap "kill $SERVER_PID $FRONTEND_PID 2>/dev/null; echo ''; echo '👋 已停止所有服务'; exit 0" SIGINT SIGTERM

echo ""
echo "✅ 前端: http://localhost:$FRONTEND_PORT"
echo "✅ 后端: http://localhost:$BACKEND_PORT"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待任意一个子进程退出
wait -n $SERVER_PID $FRONTEND_PID 2>/dev/null

# 如果有一个退出了，关闭另一个
kill $SERVER_PID $FRONTEND_PID 2>/dev/null
