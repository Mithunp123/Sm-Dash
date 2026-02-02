@echo off
echo Pushing code to GitHub...
"C:\Program Files\Git\cmd\git.exe" add .
set /p commitmsg="Enter commit message: "
"C:\Program Files\Git\cmd\git.exe" commit -m "%commitmsg%"
"C:\Program Files\Git\cmd\git.exe" push
echo Push Complete!
pause
