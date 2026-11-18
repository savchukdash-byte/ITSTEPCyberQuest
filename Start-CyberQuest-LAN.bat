@echo off
setlocal
title CyberQuest LAN
pushd "%~dp0" || exit /b 1

where node.exe >nul 2>&1
if errorlevel 1 (
    echo Install Node.js and run this launcher again.
    pause
    popd
    exit /b 1
)

node tools\serve.js --lan --open-qr %*
set "server_exit=%errorlevel%"
if not "%server_exit%"=="0" pause
popd
exit /b %server_exit%
