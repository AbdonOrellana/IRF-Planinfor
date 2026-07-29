@echo off
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Configurando Nginx Seguro...
    sc.exe stop IRF_Nginx
    sc.exe config IRF_Nginx start= disabled
    sc.exe stop nginx
    timeout /t 3 /nobreak
    sc.exe start nginx
    echo ¡Nginx reiniciado con exito en HTTPS!
) else (
    echo ERROR: DEBES EJECUTAR ESTO COMO ADMINISTRADOR
)
pause
