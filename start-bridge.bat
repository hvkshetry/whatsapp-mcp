@echo off
REM WhatsApp MCP Bridge Launcher
REM Manual startup script for the WhatsApp Go bridge

echo WhatsApp MCP Bridge Launcher
echo ============================
echo.

cd /d "%~dp0whatsapp-bridge"

if not exist main.exe (
    echo Error: main.exe not found!
    echo Please build the Go bridge first:
    echo   cd whatsapp-bridge
    echo   go build -o main.exe main.go
    pause
    exit /b 1
)

echo Starting WhatsApp Bridge...
echo.
echo The bridge will run in this window.
echo DO NOT close this window - minimize it instead.
echo.
echo To stop the bridge, press Ctrl+C
echo.

main.exe