@echo off
:: Crea (o actualiza) la tarea programada de Windows que respalda la base de datos IRF todos los dias a las 02:00.
net session >nul 2>&1
if not %errorLevel% == 0 (
    echo ERROR: DEBES EJECUTAR ESTE ARCHIVO COMO ADMINISTRADOR
    pause
    exit /b 1
)

schtasks /create /tn "IRF Respaldo BD" /tr "\"%~dp0respaldar_bd.bat\"" /sc daily /st 02:00 /ru SYSTEM /rl HIGHEST /f
if errorlevel 1 (
    echo ERROR: no se pudo crear la tarea programada.
    pause
    exit /b 1
)

echo.
echo Tarea "IRF Respaldo BD" creada: todos los dias a las 02:00.
echo Los respaldos quedan en "%~dp0respaldos" (se conservan 30 dias).
echo Probando un respaldo ahora...
call "%~dp0respaldar_bd.bat"
pause
