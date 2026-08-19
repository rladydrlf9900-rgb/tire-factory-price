@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8080"

set "PHP=php"
where php >nul 2>nul || set "PHP=%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.8.2_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe"
if not exist "%PHP%" if "%PHP%" neq "php" (
  echo PHP 가 없습니다.  명령창에서  winget install PHP.PHP.8.2  를 먼저 실행하세요.
  pause
  exit /b 1
)

"%PHP%" "%~dp0준비.php"
if errorlevel 1 (
  echo 준비 중 문제가 생겼습니다.
  pause
  exit /b 1
)

echo.
echo   http://localhost:%PORT%  에서 볼 수 있습니다.
echo   이 창을 닫으면 사이트가 멈춥니다.
echo.
start "" "http://localhost:%PORT%"
"%PHP%" -S localhost:%PORT% -t "%~dp0..\웹" "%~dp0router.php"
