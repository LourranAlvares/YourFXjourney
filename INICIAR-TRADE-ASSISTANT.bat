@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto install
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=17)?0:1)" >nul 2>nul
if errorlevel 1 goto install
node "%~dp0scripts\setup-local.cjs" %*
if errorlevel 1 pause
exit /b
:install
echo.
echo Instale o Node.js LTS, versao 22.17 ou mais recente.
echo Depois feche e abra este iniciador novamente.
choice /C SN /N /M "Abrir o site oficial do Node.js? [S/N] "
if errorlevel 2 goto done
start "" "https://nodejs.org/en/download"
:done
pause
exit /b 1
