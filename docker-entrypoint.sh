#!/bin/sh
# 以 root 啟動：確保資料目錄存在且屬於 node 使用者（Railway / Render 的 volume 都以 root 掛載），
# 然後降權成 node 執行應用程式。
set -e
DATA_DIR="$(dirname "${DATABASE_PATH:-/data/app.db}")"
mkdir -p "$DATA_DIR"
if [ "$(id -u)" = "0" ]; then
  chown -R node:node "$DATA_DIR" 2>/dev/null || true
  exec su-exec node "$@"
fi
exec "$@"
