@echo off
:: Comprobar si se esta ejecutando como Administrador
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Permisos de Administrador detectados. Continuando...
) else (
    echo =======================================================
    echo ERROR: DEBES EJECUTAR ESTE ARCHIVO COMO ADMINISTRADOR!
    echo Haz clic derecho sobre el archivo y elige "Ejecutar como administrador".
    echo =======================================================
    pause
    exit /b
)

echo ========================================================
echo Instalando Servicios IRF (Backend y Nginx) con NSSM...
echo ========================================================

set NGINX_DIR=C:\Users\Services-Planinfor\AppData\Local\Microsoft\WinGet\Packages\nginxinc.nginx_Microsoft.Winget.Source_8wekyb3d8bbwe\nginx-1.31.3
set NSSM_EXE=C:\nssm-2.24\win64\nssm.exe

echo 1. Copiando configuracion de Nginx (Puerto 8091)...
copy /Y "C:\IRF\nginx.conf.template" "%NGINX_DIR%\conf\nginx.conf"

echo 2. Creando Servicio para Node.js (Backend)...
"%NSSM_EXE%" install IRF_Backend "C:\Program Files\nodejs\node.exe" "C:\IRF\server\server.js"
"%NSSM_EXE%" set IRF_Backend AppDirectory "C:\IRF\server"

echo 3. Creando Servicio para Nginx...
"%NSSM_EXE%" install IRF_Nginx "%NGINX_DIR%\nginx.exe"
"%NSSM_EXE%" set IRF_Nginx AppDirectory "%NGINX_DIR%"

echo 4. Abriendo puerto 8091 en el Firewall de Windows...
netsh advfirewall firewall add rule name="Sistema-IRF 8091" dir=in action=allow protocol=TCP localport=8091

echo 5. Iniciando servicios...
sc start IRF_Backend
sc start IRF_Nginx

echo ========================================================
echo ¡Servicios y Firewall instalados correctamente!
echo Ahora puedes acceder al sistema IRF desde la red local a traves del puerto 8091.
echo Ejemplo: http://IP_DEL_SERVIDOR:8091/
echo Presiona cualquier tecla para salir...
pause >nul
