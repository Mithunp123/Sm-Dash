@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0\backend"
"C:\Program Files\nodejs\node.exe" server.js
pause
