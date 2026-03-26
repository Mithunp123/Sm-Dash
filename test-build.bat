@echo off
echo === SM-DASH BUILD FIX SCRIPT ===
cd /d "d:\Project-Mainfiles\Client-Project\sm-dash-main\frontend"

echo.
echo Step 1: Cleaning previous builds...
if exist "dist" rmdir /s /q dist
if exist "node_modules\.vite" rmdir /s /q node_modules\.vite

echo.
echo Step 2: Installing dependencies...
call npm install

echo.
echo Step 3: Running build...
call npm run build

echo.
if exist "dist\index.html" (
    echo ✅ Build completed successfully!
    echo ✅ Dist folder created with index.html
) else (
    echo ❌ Build failed - dist/index.html not found
)

echo.
echo Step 4: Checking for image assets...
if exist "dist\images" (
    echo ✅ Image assets copied successfully
    dir dist\images\*.png
) else (
    echo ⚠️ Image directory not found in dist
)

echo.
echo === BUILD PROCESS COMPLETE ===
pause