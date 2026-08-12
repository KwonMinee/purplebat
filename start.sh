#!/usr/bin/env bash
# 보라박쥐단 서버 실행 스크립트 (macOS / Linux)
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "[오류] Node.js가 설치되어 있지 않습니다."
  echo "https://nodejs.org 에서 LTS 버전을 설치한 뒤 이 스크립트를 다시 실행해주세요."
  echo ""
  exit 1
fi

if [ ! -d node_modules ]; then
  echo ""
  echo "처음 실행이신가요? 필요한 패키지를 설치합니다. (인터넷 연결 필요, 1~2분 소요)"
  echo ""
  npm install || { echo "[오류] npm install에 실패했습니다. 인터넷 연결을 확인해주세요."; exit 1; }
fi

echo ""
echo "보라박쥐단 서버를 시작합니다..."
echo "잠시 후 브라우저가 자동으로 열립니다. (안 열리면 http://localhost:3000 으로 직접 접속하세요)"
echo "이 터미널을 닫거나 Ctrl+C를 누르면 서버가 종료됩니다."
echo ""

(
  sleep 2
  if command -v open >/dev/null 2>&1; then
    open http://localhost:3000
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:3000
  fi
) &

node server.js
