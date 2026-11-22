@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo 请先安装免费的Node.js，再重新打开。 & pause & exit /b 1)
node admin\customer-preview.mjs
pause
