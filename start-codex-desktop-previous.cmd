@echo off
setlocal
start "" wscript.exe "%~dp0start-codex-desktop-shared-hidden.vbs" -ProfileId previous -ForceRestartMux %*
exit /b 0
