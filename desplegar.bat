@echo off
:: Despliegue en un paso del sistema IRF en el servidor (carpeta C:\IRF, clon del repositorio).
:: Respalda la base de datos, descarga la ultima version, compila la app web y reinicia el backend.
:: Ejecutar como Administrador. Nginx sirve directamente C:\IRF\dist, por lo que no necesita reiniciarse.
setlocal

:: git pull puede modificar este mismo archivo mientras corre: ejecutar desde una copia temporal
if /i not "%~1"=="--desde-copia" (
    copy /y "%~f0" "%TEMP%\irf_desplegar.bat" >nul
    call "%TEMP%\irf_desplegar.bat" --desde-copia "%~dp0"
    exit /b %errorlevel%
)
cd /d "%~2"

net session >nul 2>&1
if not %errorLevel% == 0 (
    echo ERROR: DEBES EJECUTAR ESTE ARCHIVO COMO ADMINISTRADOR
    pause
    exit /b 1
)

set "ENVFILE="
if exist "server\.env" set "ENVFILE=server\.env"
if not defined ENVFILE if exist ".env" set "ENVFILE=.env"
if not defined ENVFILE (
    echo ERROR: no existe server\.env ni .env con la configuracion del servidor.
    goto :fallo
)
findstr /b "JWT_SECRET=" "%ENVFILE%" >nul || (
    echo ERROR: falta JWT_SECRET en %ENVFILE%. Agregue una linea JWT_SECRET=^<texto largo al azar^>.
    goto :fallo
)

echo [1/6] Respaldando base de datos...
call respaldar_bd.bat || goto :fallo

echo [2/6] Descargando la ultima version (git pull)...
git pull --ff-only || goto :fallo

echo [3/6] Deteniendo backend...
sc stop IRF_Backend >nul 2>&1
timeout /t 3 /nobreak >nul

echo [4/6] Instalando dependencias...
call npm ci --no-audit --no-fund || goto :fallo_iniciar

echo [5/6] Compilando la app web...
call npm run build || goto :fallo_iniciar

echo [6/6] Iniciando backend...
sc start IRF_Backend >nul || goto :fallo
timeout /t 5 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -TimeoutSec 15 http://localhost:3000/api/health; if ($r.status -ne 'ok') { exit 1 } } catch { exit 1 }" || (
    echo ERROR: el backend no responde en http://localhost:3000/api/health
    goto :fallo
)

echo.
echo ========================================================
echo  Despliegue completado. Version:
call node -p "require('./package.json').version"
echo ========================================================
pause
exit /b 0

:fallo_iniciar
echo Volviendo a iniciar el backend con la version anterior...
sc start IRF_Backend >nul 2>&1
:fallo
echo.
echo ========================================================
echo  EL DESPLIEGUE FALLO. Revise el mensaje de error arriba.
echo ========================================================
pause
exit /b 1
