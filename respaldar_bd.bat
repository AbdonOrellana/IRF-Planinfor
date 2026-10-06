@echo off
:: Respaldo de la base de datos IRF (PostgreSQL) en la carpeta "respaldos" junto a este archivo.
:: Guarda un archivo por ejecucion y borra los de mas de 30 dias.
:: Se ejecuta a diario con la tarea programada que crea instalar_respaldo_diario.bat.
:: Restaurar un respaldo:  pg_restore -U postgres -d irf_db --clean --if-exists respaldos\ARCHIVO.dump
setlocal
cd /d "%~dp0"

set "DIAS_A_CONSERVAR=30"
set "DESTINO=%~dp0respaldos"

:: Leer DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASSWORD desde server\.env o .env
set "ENVFILE="
if exist "%~dp0server\.env" set "ENVFILE=%~dp0server\.env"
if not defined ENVFILE if exist "%~dp0.env" set "ENVFILE=%~dp0.env"
if defined ENVFILE (
    for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%ENVFILE%") do set "%%a=%%b"
)
if not defined DB_HOST set "DB_HOST=localhost"
if not defined DB_PORT set "DB_PORT=5432"
if not defined DB_NAME set "DB_NAME=irf_db"
if not defined DB_USER set "DB_USER=postgres"

:: Buscar pg_dump (en el PATH o en la instalacion de PostgreSQL mas reciente)
set "PG_DUMP="
for /f "delims=" %%p in ('where pg_dump 2^>nul') do if not defined PG_DUMP set "PG_DUMP=%%p"
if not defined PG_DUMP (
    for /d %%d in ("%ProgramFiles%\PostgreSQL\*") do if exist "%%d\bin\pg_dump.exe" set "PG_DUMP=%%d\bin\pg_dump.exe"
)
if not defined PG_DUMP (
    echo ERROR: no se encontro pg_dump. Instale PostgreSQL o agreguelo al PATH.
    exit /b 1
)

if not exist "%DESTINO%" mkdir "%DESTINO%"
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmm"') do set "FECHA=%%t"
set "ARCHIVO=%DESTINO%\%DB_NAME%_%FECHA%.dump"

echo Respaldando "%DB_NAME%" en "%ARCHIVO%"...
set "PGPASSWORD=%DB_PASSWORD%"
"%PG_DUMP%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -F c -f "%ARCHIVO%" %DB_NAME%
if errorlevel 1 (
    echo ERROR: el respaldo fallo.
    if exist "%ARCHIVO%" del "%ARCHIVO%"
    exit /b 1
)

:: Borrar respaldos antiguos
forfiles /p "%DESTINO%" /m *.dump /d -%DIAS_A_CONSERVAR% /c "cmd /c del @path" >nul 2>&1

echo Respaldo completado.
exit /b 0
