@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS, then reopen this script.
  pause
  exit /b 1
)
echo ChessMST full database backup and response export
echo Required Cloudflare sign-in: alexitoo96@gmail.com
echo.
node "%~dp0tools\export-all.mjs" %*
set "exportExit=%errorlevel%"
if not "%exportExit%"=="0" echo Export failed. Read the error and recovery steps above. No database records were deleted.
pause
exit /b %exportExit%
