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

3. Puedes abrir Android Studio para compilar la aplicación y firmarla, o generarla por consola desde el directorio `android/`:
   ```bash
   cd android
   .\gradlew.bat assembleDebug
   ```
   *El APK quedará disponible en la ruta: `android/app/build/outputs/apk/debug/app-debug.apk`.*

## Licencia
Propiedad de Planinfor.
