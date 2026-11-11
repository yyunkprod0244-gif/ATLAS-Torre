@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale em https://nodejs.org e tente de novo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando dependencias, aguarde...
  call npm install
)
node server.mjs --abrir
pause
