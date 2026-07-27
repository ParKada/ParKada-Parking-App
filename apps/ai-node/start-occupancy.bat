@echo off
echo ========================================================
echo   Starting ParKada Live Camera Feed & Secure Tunnel
echo ========================================================
echo.
echo [1/2] Starting AI Camera Backend (smart_slots.py)...
start "ParKada Camera AI" cmd /c "python smart_slots.py"
timeout /t 3 /nobreak > nul

echo [2/2] Starting Cloudflare Secure Tunnel (camera.parkada.site)...
cloudflared tunnel --config cloudflared_config.yml run parkada-cam

pause
