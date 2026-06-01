@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-codex-desktop-shared.ps1" -ProfileId previous -ForceRestartMux %*
