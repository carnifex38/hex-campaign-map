@echo off
title Cartograph-Pattern Tactical Grid
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo ============================================================
    echo   Node.js is not installed on this computer.
    echo   Please install it first from https://nodejs.org
    echo   ^(choose the "LTS" version^), then double-click this file
    echo   again.
    echo ============================================================
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Setting up the map for the first time, please wait...
    call npm install
    if errorlevel 1 (
        echo.
        echo Something went wrong installing dependencies. See the messages above.
        pause
        exit /b 1
    )
)

echo Starting the map server...
start "Cartograph-Pattern Tactical Grid - Server" cmd /k npm run dev

timeout /t 5 /nobreak >nul
start http://localhost:5173

echo.
echo The map should now be open in your browser.
echo To stop it, close the "Cartograph-Pattern Tactical Grid - Server" window.
echo.
pause
