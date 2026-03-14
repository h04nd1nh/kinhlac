#!/bin/bash
set -e

echo "========================================="
echo "  Build local cho deploy"
echo "========================================="

# Build backend
echo "[1/4] Cài dependencies backend..."
cd backend
npm install
echo "[2/4] Build backend..."
npm run build
cd ..

# Build frontend
echo "[3/4] Cài dependencies frontend..."
cd frontend
pnpm install
echo "[4/4] Build frontend..."
NUXT_PUBLIC_API_BASE=http://103.57.221.26:3001 pnpm build
cd ..

echo ""
echo "========================================="
echo "  Build xong! Giờ chạy lệnh deploy:"
echo "========================================="
echo ""
echo "  scp -r backend/dist backend/package.json backend/package-lock.json pkndswbxhosting@103.57.221.26:~/medicine/backend/"
echo "  scp -r frontend/.output pkndswbxhosting@103.57.221.26:~/medicine/frontend/"
echo "  scp ecosystem.config.cjs pkndswbxhosting@103.57.221.26:~/medicine/"
