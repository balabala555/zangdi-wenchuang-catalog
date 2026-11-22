@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo 未找到 Node.js，请先安装后再运行。 & pause & exit /b 1)
echo 正在安全更新当前测试分支；后台商品库不会被程序更新覆盖。
node scripts\local-preview.mjs update
pause
