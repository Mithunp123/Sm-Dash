@echo off
REM Add Node.js to PATH and run npm start
set PATH=C:\Program Files\nodejs;%PATH%
cd /d C:\sm-dash-main\backend
node server.js
