@echo off
chcp 65001 >nul
title 보라박쥐단 서버
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [오류] Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치한 뒤 이 파일을 다시 실행해주세요.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo 처음 실행이신가요? 필요한 패키지를 설치합니다. ^(인터넷 연결 필요, 1~2분 소요^)
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [오류] npm install에 실패했습니다. 인터넷 연결을 확인해주세요.
    pause
    exit /b 1
  )
)

echo.
echo 보라박쥐단 서버를 시작합니다...
echo 잠시 후 브라우저가 자동으로 열립니다. ^(안 열리면 http://localhost:3000 으로 직접 접속하세요^)
echo 이 창을 닫으면 서버가 종료됩니다.
echo.

start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
node server.js

pause
