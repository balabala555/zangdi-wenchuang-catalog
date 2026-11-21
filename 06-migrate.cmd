@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo 请先安装免费的 Node.js，然后重新双击本入口。 & pause & exit /b 1)
echo 请在接下来的窗口中选择原网站文件夹，里面应有02-start.cmd。
node scripts\local-preview.mjs install
pause
