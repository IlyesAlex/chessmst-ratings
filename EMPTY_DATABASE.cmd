@echo off
cd /d "%~dp0"
node tools\empty-database.mjs
if errorlevel 1 echo Cleanup failed or could not be verified. Read the error above before trying again.
pause
