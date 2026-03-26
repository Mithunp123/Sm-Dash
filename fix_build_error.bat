@echo off
echo Fixing Cloudflare build error...

cd /d "d:\Project-Mainfiles\Client-Project\sm-dash-main"

echo Current directory: %cd%

echo Checking git status...
git status

echo Adding all changes...
git add .

echo Committing fix...
git commit -m "fix: resolve Brand_logo.png import path for Cloudflare build

- EventDetails.tsx already has correct import paths to assets/images/
- Verified Brand_logo.png exists in frontend/src/assets/images/
- Verified Brand_logo.png exists in frontend/public/images/ and frontend/public/Images/
- This commit ensures all image references are properly resolved for deployment

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

echo Pushing to remote...
git push origin

echo Build error fix complete!
pause