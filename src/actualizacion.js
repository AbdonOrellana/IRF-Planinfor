// Actualización de la app: compara la versión instalada con la más nueva que publica el servidor
// (IRF-Planinfor-<versión>.apk en la carpeta "apk" del servidor) y abre la descarga del APK.
import { Browser } from '@capacitor/browser';
import { tryFetchWithFallback, getServerUrl } from './api.js';

// Viene de "version" en package.json (ver vite.config.js)
export const VERSION_APP = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

function esMasNueva(candidata, actual) {
    const a = String(candidata).split('.').map(Number);
    const b = String(actual).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
    }
    return false;
}

// Devuelve { version, url } si el servidor tiene una versión más nueva; si no (o sin conexión), null
export async function buscarActualizacion() {
    try {
        const response = await tryFetchWithFallback('/api/app-version');
        if (!response.ok) return null;
        const { version } = await response.json();
        if (!version || !esMasNueva(version, VERSION_APP)) return null;
        return { version, url: getServerUrl().replace(/\/$/, '') + '/api/app.apk' };
    } catch (e) {
        return null; // servidor sin esta función o sin señal: la app sigue funcionando
    }
}

// Abre la descarga fuera de la app (el navegador del equipo baja el APK y Android ofrece instalarlo)
export async function abrirDescargaApp(url) {
    try {
        await Browser.open({ url });
    } catch (e) {
        window.open(url, '_blank');
    }
}
