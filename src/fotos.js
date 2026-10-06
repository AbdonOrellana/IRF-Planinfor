// Fotos del formulario: compresión antes de enviar y subida separada (una por una, sin repetir las que
// el servidor ya tiene). El formulario viaja con referencias "foto:sha256:<hash>" en vez de las imágenes.
import { tryFetchWithFallback } from './api.js';

const MAX_FOTO_CHARS = 400000; // ~300 KB de JPEG en base64

export function comprimirDataUrl(dataUrl, maxDim = 1280, quality = 0.6) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                const out = canvas.toDataURL('image/jpeg', quality);
                resolve(out.length < dataUrl.length ? out : dataUrl);
            } catch (e) {
                resolve(dataUrl);
            }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

// Reduce el tamaño del formulario antes de enviarlo (fotos pesadas y peligros_hidden duplicado).
// Devuelve true si el objeto cambió.
export async function compactarFormularioParaSync(formObj) {
    const data = formObj && formObj.data;
    if (!data) return false;
    let changed = false;
    if (data.inputs && 'peligros_hidden' in data.inputs) {
        delete data.inputs.peligros_hidden;
        changed = true;
    }
    for (const p of (Array.isArray(data.peligros) ? data.peligros : [])) {
        if (p && typeof p.fotoBase64 === 'string' && p.fotoBase64.length > MAX_FOTO_CHARS) {
            const reducida = await comprimirDataUrl(p.fotoBase64);
            if (reducida !== p.fotoBase64) {
                p.fotoBase64 = reducida;
                changed = true;
            }
        }
    }
    return changed;
}


const FOTO_REF_PREFIX = 'foto:sha256:';
const MIN_FOTO_CHARS = 2000; // mismo umbral que el servidor (server/fotos.js)

function esDataUrlImagen(valor) {
    return typeof valor === 'string' && valor.startsWith('data:image/') && valor.length >= MIN_FOTO_CHARS;
}

async function sha256Hex(texto) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('');
}

// Copia profunda aplicando fn (asíncrona) a cada string
async function mapearStrings(valor, fn) {
    if (typeof valor === 'string') return fn(valor);
    if (Array.isArray(valor)) return Promise.all(valor.map(v => mapearStrings(v, fn)));
    if (valor && typeof valor === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(valor)) out[k] = await mapearStrings(v, fn);
        return out;
    }
    return valor;
}

/**
 * Sube al servidor las fotos del formulario que aún no tiene y devuelve una copia del formulario con
 * referencias en lugar de imágenes. Si una foto falla, las ya subidas no se repiten en el próximo intento.
 * Si el servidor no soporta la subida separada (versión anterior), devuelve el formulario completo.
 */
export async function prepararEnvioConFotos(formObj) {
    if (!(window.crypto && crypto.subtle)) return formObj;

    const fotos = new Map();
    const payload = await mapearStrings(formObj, async (s) => {
        if (!esDataUrlImagen(s)) return s;
        const hash = await sha256Hex(s);
        fotos.set(hash, s);
        return FOTO_REF_PREFIX + hash;
    });
    if (fotos.size === 0) return formObj;

    const res = await tryFetchWithFallback('/api/fotos/faltantes', {
        method: 'POST',
        body: JSON.stringify({ hashes: [...fotos.keys()] })
    });
    let faltantes;
    try {
        faltantes = res.ok ? (await res.json()).faltantes : null;
    } catch (e) {
        faltantes = null; // respuesta que no es JSON: servidor antiguo
    }
    if (!Array.isArray(faltantes)) return formObj;

    for (const hash of faltantes) {
        const subida = await tryFetchWithFallback('/api/fotos', {
            method: 'POST',
            body: JSON.stringify({ hash, data: fotos.get(hash) })
        });
        if (!subida.ok) throw new Error(`No se pudo subir una foto (HTTP ${subida.status}). Se reintentará.`);
    }
    return payload;
}
