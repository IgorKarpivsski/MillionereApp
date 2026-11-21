@echo off
chcp 65001 >nul
title Haaluf Live
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  Opening the download page - install the LTS version, then run start.bat again.
  echo.
  start https://nodejs.org/
  pause
  exit /b
)

if not exist node_modules\tiktok-live-connector (
  echo  First run: installing... ^(about a minute^)
  call npm install --omit=dev --no-audit --no-fund
)

start "" http://localhost:5177
node server.js
pause
