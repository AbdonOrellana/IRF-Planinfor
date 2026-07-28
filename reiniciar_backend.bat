@echo off
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Reiniciando Backend para aplicar cambios de PostgreSQL...
    sc stop IRF_Backend
    timeout /t 3 /nobreak
    sc start IRF_Backend
    echo ¡Backend reiniciado con exito!
) else (
    echo ERROR: DEBES EJECUTAR ESTO COMO ADMINISTRADOR
)
pause
