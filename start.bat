@echo off
cd /d "%~dp0"

if not exist "node_modules" (
  echo Nu gasesc node_modules, instalez dependintele...
  call npm install
)

echo Pornesc CrissCall pe http://localhost:3000 ...
start "CrissCall Server" cmd /k node server.js

timeout /t 3 /nobreak >nul
start http://localhost:3000
