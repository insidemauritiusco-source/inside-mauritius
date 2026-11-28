@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Install Python 3 from python.org and try again.
  pause
  exit /b 1
)
echo Use only a trusted private Wi-Fi network. Do not enable public firewall access or port forwarding.
py -3 samsung-local-test.py
pause
