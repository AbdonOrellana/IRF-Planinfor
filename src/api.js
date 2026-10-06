// Comunicación con el servidor IRF (URL configurable, reintentos, token de sesión)

export const SERVIDOR_PRODUCCION = 'https://services.planinfor.cl:8091';

export function getServerUrl() {
    let url = localStorage.getItem('irf_server_url');
    if (!url || url.startsWith('http://services.planinfor.cl') || url.startsWith('http://190.13.189.196')) {
        url = SERVIDOR_PRODUCCION;
        localStorage.setItem('irf_server_url', url);
    }
    return url;
}

export function setServerUrl(url) {
    if (url) {
        let clean = url.trim().replace(/\/$/, '');
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
            clean = 'https://' + clean;
        }
        if (clean.includes('services.planinfor.cl')) {
            clean = clean.replace(/^http:\/\//, 'https://');
        }
        localStorage.setItem('irf_server_url', clean);
    }
}

export function esServidorProduccion() {
    return getServerUrl().replace(/\/$/, '') === SERVIDOR_PRODUCCION;
}

export async function tryFetchWithFallback(endpoint, options = {}) {
    // En desarrollo (vite) se usa el mismo origen: el proxy de vite envía /api al backend local.
    // Solo se usa el servidor configurado: si es uno de pruebas y no responde, nunca se cae a producción.
    const candidateUrls = import.meta.env.DEV ? [''] : [getServerUrl().replace(/\/$/, '')];

    const authToken = sessionStorage.getItem('irf_auth_token');
    const enviaToken = !!authToken && endpoint !== '/api/login';

    const uniqueCandidates = [...new Set(candidateUrls)];
    let lastError = null;
    let lastResponse = null;

    // En terreno (datos móviles con poca señal) la subida es lenta: el timeout crece con el tamaño
    // del envío (30 s + 30 s por MB, máx. 3 min) y los errores de red se reintentan.
    const bodySize = typeof options.body === 'string' ? options.body.length : 0;
    const timeoutMs = Math.min(180000, 30000 + Math.ceil(bodySize / 1048576) * 30000);
    const maxIntentos = 3;

    const attempts = [];
    for (let i = 0; i < maxIntentos; i++) attempts.push(...uniqueCandidates);

    for (let i = 0; i < attempts.length; i++) {
        const baseUrl = attempts[i];
        if (i > 0 && lastResponse) break; // el servidor respondió: no tiene sentido reintentar
        if (i > 0) await new Promise(r => setTimeout(r, 2000 * i));

        const targetUrl = baseUrl + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const res = await fetch(targetUrl, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...(enviaToken ? { Authorization: 'Bearer ' + authToken } : {}),
                    ...(options.headers || {})
                }
            });
            clearTimeout(timeoutId);
            if (res.ok) return res;
            if (res.status === 401 && enviaToken) window.dispatchEvent(new Event('irf:sesion-expirada'));
            lastResponse = res;
        } catch (err) {
            clearTimeout(timeoutId);
            lastError = err;
            console.warn(`Intento fallido a ${targetUrl}:`, err);
        }
    }

    if (lastResponse) return lastResponse;
    if (lastError && lastError.name === 'AbortError') {
        throw new Error('La conexión es muy lenta y el envío no alcanzó a completarse. Intente nuevamente con mejor señal.');
    }
    throw lastError || new Error('No se pudo conectar a ningún servidor de sincronización.');
}
