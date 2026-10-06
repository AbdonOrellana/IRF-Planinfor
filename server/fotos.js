// Fotos y firmas se guardan una sola vez (tabla "fotos", clave = SHA-256 del data URL) y los formularios
// y su historial de versiones solo guardan la referencia "foto:sha256:<hash>".
import crypto from 'crypto';

export const FOTO_REF_PREFIX = 'foto:sha256:';
const FOTO_REF_REGEX = /^foto:sha256:[0-9a-f]{64}$/;
// Imágenes más chicas que esto (íconos, firmas vacías) no vale la pena separarlas
const MIN_FOTO_CHARS = 2000;
export const MAX_FOTO_CHARS = 15 * 1024 * 1024;

export function esDataUrlImagen(valor) {
    return typeof valor === 'string' && valor.startsWith('data:image/') && valor.length >= MIN_FOTO_CHARS;
}

export function esReferenciaFoto(valor) {
    return typeof valor === 'string' && FOTO_REF_REGEX.test(valor);
}

export function esHashValido(hash) {
    return typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash);
}

export function hashFoto(dataUrl) {
    return crypto.createHash('sha256').update(dataUrl, 'utf8').digest('hex');
}

// Copia profunda aplicando fn a cada string
function mapearStrings(valor, fn) {
    if (typeof valor === 'string') return fn(valor);
    if (Array.isArray(valor)) return valor.map(v => mapearStrings(v, fn));
    if (valor && typeof valor === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(valor)) out[k] = mapearStrings(v, fn);
        return out;
    }
    return valor;
}

/**
 * Quita del payload los datos redundantes: inputs.peligros_hidden repite data.peligros (con fotos incluidas)
 */
export function normalizarPayload(data) {
    if (!data || typeof data !== 'object') return data;
    if (data.inputs && 'peligros_hidden' in data.inputs) {
        const { peligros_hidden, ...inputs } = data.inputs;
        return { ...data, inputs };
    }
    return data;
}

/**
 * Reemplaza las imágenes del payload por referencias.
 * Devuelve el payload sin imágenes, las imágenes nuevas (hash -> dataUrl) y todas las referencias usadas.
 */
export function extraerFotos(payload) {
    const fotos = new Map();
    const referencias = new Set();
    const resultado = mapearStrings(payload, (s) => {
        if (esDataUrlImagen(s)) {
            const hash = hashFoto(s);
            fotos.set(hash, s);
            referencias.add(hash);
            return FOTO_REF_PREFIX + hash;
        }
        if (esReferenciaFoto(s)) referencias.add(s.slice(FOTO_REF_PREFIX.length));
        return s;
    });
    return { payload: resultado, fotos, referencias };
}

export function referenciasEn(payload) {
    return extraerFotos(payload).referencias;
}

/**
 * Vuelve a poner las imágenes en el payload. Una referencia sin foto queda como null.
 */
export function rehidratar(payload, fotosPorHash) {
    return mapearStrings(payload, (s) => esReferenciaFoto(s) ? (fotosPorHash.get(s.slice(FOTO_REF_PREFIX.length)) ?? null) : s);
}

// JSON con claves ordenadas: PostgreSQL (jsonb) no conserva el orden de las claves,
// así que JSON.stringify por sí solo nunca detectaría un reenvío idéntico
export function stringifyEstable(valor) {
    if (Array.isArray(valor)) return '[' + valor.map(stringifyEstable).join(',') + ']';
    if (valor && typeof valor === 'object') {
        return '{' + Object.keys(valor).sort().map(k => JSON.stringify(k) + ':' + stringifyEstable(valor[k])).join(',') + '}';
    }
    return JSON.stringify(valor ?? null);
}
