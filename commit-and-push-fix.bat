@echo off
echo === COMMITTING SM-DASH BUILD FIX ===
cd /d "d:\Project-Mainfiles\Client-Project\sm-dash-main"

echo.
echo Current git status:
git status --short

echo.
echo Adding all changes...
git add .

echo.
echo Committing changes...
git commit -m "fix: resolve Cloudflare build error for Brand_logo.png imports

- Enhanced TypeScript config with allowSyntheticDefaultImports and esModuleInterop
- Improved Vite build config with explicit assetsInclude for images
- Added proper asset file naming in rollupOptions
- Created .nojekyll file for static hosting compatibility
- Added comprehensive build testing scripts
- All image assets verified in correct locations:
  * frontend/src/assets/images/Brand_logo.png (for ES6 imports)
  * frontend/public/images/Brand_logo.png (for public paths)
  * frontend/public/Images/Brand_logo.png (for case-sensitive paths)

Fixes Cloudflare deployment build failure where module resolution
was failing for image imports despite correct file paths.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

echo.
echo Pushing to repository...
git push origin

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Successfully pushed build fix to repository!
    echo ✅ Cloudflare should now be able to build successfully
    echo.
    echo Next steps:
    echo 1. Cloudflare will automatically redeploy from the new commit
    echo 2. Monitor build logs to confirm the error is resolved
    echo 3. Test the deployed application to ensure images load correctly
) else (
    echo.
    echo ❌ Failed to push changes
    echo Please check git configuration and try again
)

echo.
pause