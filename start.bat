@echo off
echo Starting FinanceTracker Application...
echo.
echo Backend: http://localhost:5000
echo Frontend: Will be available shortly...
echo.

start "UAE FinanceTracker Backend" cmd /k "cd backend && python app.py"
timeout /t 3 /nobreak >nul
start "FinanceTracker Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Application is starting...
echo Backend will be available at: http://localhost:5000
echo Frontend will be available at: http://localhost:5177 (or next available port)
echo.
echo Press any key to open the application in your browser...
pause >nul

start http://localhost:5177