@echo off
cd /d "%~dp0"
node tools\export-all.mjs
if errorlevel 1 echo Export failed. Read the error above. No database records were deleted.
pause
