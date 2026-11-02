@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS, then reopen this script.
  pause
  exit /b 1
)
echo ChessMST database administration
echo Required Cloudflare sign-in: alexitoo96@gmail.com
echo.
node "%~dp0tools\empty-database.mjs" %*
set "cleanupExit=%errorlevel%"
if not "%cleanupExit%"=="0" echo Cleanup failed or could not be verified. Read the error and recovery steps above.
pause
exit /b %cleanupExit%
