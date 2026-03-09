@echo off
echo ========================================
echo   US ETF Analysis Dashboard
echo ========================================
echo.

REM Install dependencies if needed
echo Checking dependencies...
pip show fastapi >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing dependencies...
    cd /d "%~dp0backend"
    pip install -r requirements.txt
)

echo [1/2] Starting Backend Server...
cd /d "%~dp0backend\src"
start "Backend Server" cmd /k "python main.py"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend Server...
cd /d "%~dp0frontend"
start "Frontend Server" cmd /k "npm run dev"

timeout /t 5 /nobreak > nul

REM Open browser
echo Opening Chrome...
start chrome http://localhost:5173

echo.
echo ========================================
echo   Dashboard is starting...
echo   
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo ========================================
echo.
echo Press any key to exit (servers will keep running)...
pause > nul
