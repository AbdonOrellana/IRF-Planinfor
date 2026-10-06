# IRF Planinfor

Aplicación para la Identificación de Riesgos y Fatalidades (IRF), desarrollada con HTML, CSS, Vanilla JS y empaquetada con Vite y Capacitor. La aplicación permite a los usuarios registrar inspecciones, participantes, riesgos (peligros) detectados en terreno, y generar un reporte detallado en formato PDF.

## Características

- **Registro por Pasos:** Interfaz amigable separada por pasos tipo acordeón para facilitar el llenado progresivo.
- **Modo Offline-First:** Diseñado para usarse en entornos sin conexión a internet. Los datos se guardan temporalmente de forma local.
- **Exportación a PDF:** Generación automática de reportes PDF que incluyen los datos de inspección, los riesgos registrados y un listado de participantes.
- **Autocompletado y validación de campos:** Controles específicos y validaciones para asegurar el correcto llenado del formulario, por ejemplo, estado de implementación y matrices de riesgos iniciales y residuales.
- **Empaquetado Móvil:** Convertido a aplicación nativa Android (APK) utilizando Capacitor, con soporte para cámara y geolocalización.

## Tecnologías Utilizadas

- HTML5 / CSS3 / JavaScript Vainilla
- [Vite](https://vitejs.dev/) - Herramienta de compilación rápida.
- [Capacitor](https://capacitorjs.com/) - Para compilación a Android nativo.
- Generación de PDF integrada en el cliente web.

## Requisitos Previos

Asegúrate de tener instalados los siguientes componentes:
- [Node.js](https://nodejs.org/) (versión recomendada LTS)
- NPM o Yarn
- Android Studio (para generar el APK)

## Instalación y Desarrollo Local

1. Clona el repositorio:
   ```bash
   git clone https://github.com/AbdonOrellana/IRF-Planinfor.git
   ```

2. Entra al directorio del proyecto:
   ```bash
   cd IRF-Planinfor
   ```

3. Instala las dependencias:
   ```bash
   npm install
   ```

4. Ejecuta el servidor de desarrollo local:
   ```bash
   npm run dev
   ```
   *La aplicación estará disponible en `http://localhost:5173` o en la IP local que asigne tu red.*

## Compilar para Android (APK)

Para construir la aplicación Android, sigue estos pasos:

1. Compila los recursos de la web:
   ```bash
   npm run build
   ```

2. Sincroniza los archivos con el proyecto de Capacitor:
   ```bash
   npx cap sync android
   ```

3. Genera el APK firmado de producción desde el directorio `android/`:
   ```bash
   cd android
   .\gradlew.bat assembleRelease
   ```
   *El APK queda en `android/app/build/outputs/apk/release/IRF-Planinfor-release.apk`.*

### Versión y firma del APK

- La versión sale de `"version"` en `package.json` (por ejemplo `1.1.0` → versionCode `10100`). **Súbela antes de cada APK que se distribuya**; Android solo instala una actualización si la versión es mayor.
- El APK se firma con `android/irf-release.jks` usando las claves de `android/keystore.properties`. Ninguno de los dos se sube a git: **guarda una copia de ambos en un lugar seguro**. Si se pierden, no se podrá actualizar la app en los equipos sin desinstalarla (y desinstalar borra los formularios no enviados).
- Para pruebas sigue sirviendo `.\gradlew.bat assembleDebug`, pero un APK de prueba no se puede instalar encima de uno de producción ni al revés (tienen firmas distintas).

## Servidor (producción)

El servidor corre en Windows desde `C:\IRF` (clon de este repositorio): Nginx en el puerto 8091 sirve `C:\IRF\dist` y redirige `/api/` al backend Node (servicio `IRF_Backend`, puerto 3000). La primera instalación se hace con `instalar_servicios.bat`.

### Configuración (`server\.env` o `.env`)

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=irf_db
DB_USER=postgres
DB_PASSWORD=...
JWT_SECRET=<texto largo al azar; firma las sesiones>
```

Opcional: `ADMIN_USER`/`ADMIN_PASS` (y `TEST_USER`/`TEST_PASS`) crean esos usuarios al arrancar si todavía no existen.

### Desplegar una nueva versión

En el servidor, como Administrador, ejecutar `desplegar.bat`. El script:
1. Respalda la base de datos.
2. Descarga la última versión con `git pull`.
3. Instala dependencias y compila la app web.
4. Reinicia el backend y comprueba que responda.

### Usuarios del panel prevencionista

```bash
npm run usuarios -- listar
npm run usuarios -- crear <usuario>      # pide la contraseña; también sirve para cambiarla
npm run usuarios -- eliminar <usuario>
```

### Respaldos de la base de datos

- `instalar_respaldo_diario.bat` (como Administrador) crea la tarea programada "IRF Respaldo BD", que se ejecuta todos los días a las 02:00.
- Los respaldos quedan en `C:\IRF\respaldos` y se conservan 30 días. Para un respaldo manual, ejecutar `respaldar_bd.bat`.
- Para restaurar uno:
  ```bash
  pg_restore -U postgres -d irf_db --clean --if-exists respaldos\irf_db_AAAAMMDD_HHMM.dump
  ```

## Estructura del código (`src/`)

| Archivo | Contenido |
|---|---|
| `main.js` | Formulario, PDF, bandeja, fundos visitados (pantalla) y vista del prevencionista |
| `sync.js` | Envío de formularios, sincronización automática, respaldo y restauración de pendientes |
| `fotos.js` | Compresión y subida separada de fotos |
| `api.js` | Comunicación con el servidor (URL, reintentos, token de sesión) |
| `formStore.js` | Almacenamiento de formularios en el equipo (IndexedDB) |
| `bandeja.js` | Índice de formularios guardados y su estado de envío |
| `fundosVisitados.js` | Datos de fundos visitados (locales y compartidos por el servidor) |
| `dialogs.js`, `utils.js` | Diálogos, avisos y utilidades de interfaz |

## Licencia
Propiedad de Planinfor.
