@echo off
REM Starts a small local web server for the app and opens it in your browser.
REM Close this window to stop the server.
cd /d "%~dp0"
echo.
echo   Pady is running at  http://localhost:8080
echo   Keep this window open while you use the app. Close it to stop.
echo.
start "" http://localhost:8080
python -m http.server 8080 2>nul || py -m http.server 8080
pause
