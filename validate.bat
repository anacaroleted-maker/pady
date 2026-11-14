@echo off
REM Checks the exercise files for mistakes and prints a report.
cd /d "%~dp0"
python tools\validate.py 2>nul || py tools\validate.py
echo.
pause
