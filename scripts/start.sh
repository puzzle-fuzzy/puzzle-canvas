#!/bin/bash

# Puzzle Canvas 启动脚本
# 启动前自动清理旧端口进程

FRONTEND_PORT=5175
BACKEND_PORT=3001

echo "🧹 清理旧进程..."

for PORT in $FRONTEND_PORT $BACKEND_PORT; do
  PIDS=$(lsof -ti:$PORT 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill 2>/dev/null
    echo "  已关闭端口 $PORT (PID: $(echo $PIDS | tr '\n' ' '))"
  else
    echo "  端口 $PORT 无进程"
  fi
done

# 等待端口释放
sleep 1

echo ""
echo "🚀 启动服务..."

# 直接执行命令，不通过 bun run 包装
bun --hot server/index.ts &
SERVER_PID=$!

bunx vite &
FRONTEND_PID=$!

# 捕获 Ctrl+C 同时关闭两个进程
cleanup() {
  echo ""
  echo "👋 正在停止所有服务..."
  kill $SERVER_PID $FRONTEND_PID 2>/dev/null
  wait $SERVER_PID $FRONTEND_PID 2>/dev/null
  echo "✅ 已停止"
  exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo "✅ 前端: http://localhost:$FRONTEND_PORT"
echo "✅ 后端: http://localhost:$BACKEND_PORT"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 保持脚本运行
wait
