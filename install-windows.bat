@echo off
title YouTube -^> Resolve installer
rem One-click Windows installer. Downloads + runs the PowerShell installer as admin.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator rights...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Installing the YouTube -^> Resolve plugin...
echo (this downloads the plugin, yt-dlp and ffmpeg - give it a moment)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; iwr -useb 'https://raw.githubusercontent.com/Dogender2/youtube-to-resolve/main/tools/install-windows.ps1' | iex"
echo.
pause
