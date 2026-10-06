// Fundos visitados: datos propios de cada fundo para precargar un IRF nuevo en el mismo fundo.
// Se guardan en el equipo (funciona sin señal) y se completan con los fundos que otros equipos ya enviaron al servidor.
import { getForm } from './formStore.js';
import { getSavedFormsList } from './bandeja.js';
import { tryFetchWithFallback } from './api.js';

// Guarda los datos propios de cada fundo (área, coordenadas de rescate y peligros identificados)
// para precargarlos cuando se vuelve a hacer un IRF en el mismo fundo, incluso sin conexión.
const FUNDOS_VISITADOS_KEY = 'irf_fundos_visitados';

export function normalizarFundo(nombre) {
    return (nombre || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function getFundosVisitados() {
    try {
        return JSON.parse(localStorage.getItem(FUNDOS_VISITADOS_KEY)) || {};
    } catch (e) {
        return {};
    }
}

export function setFundosVisitados(map) {
    localStorage.setItem(FUNDOS_VISITADOS_KEY, JSON.stringify(map));
}

export function getFundoVisitado(nombre) {
    const key = normalizarFundo(nombre);
    return key ? getFundosVisitados()[key] || null : null;
}

// Peligros sin los datos propios de una visita (fecha, foto, firma, estado del control)
export function peligrosReutilizables(peligros) {
    return (Array.isArray(peligros) ? peligros : []).filter(p => p && p.descripcion).map(p => ({
        ...p,
        fecha: '',
        estado: 'I',
        control_fecha: '',
        firma_sup: '',
        fotoBase64: null
    }));
}

export function registrarFundoVisitado(data, savedAt) {
    const inputs = (data && data.inputs) || {};
    const fundo = (inputs.fundo_instalacion || '').trim();
    const key = normalizarFundo(fundo);
    if (!key) return;

    const map = getFundosVisitados();
    const prev = map[key] || {};
    const fecha = savedAt || Date.now();
    if (prev.updatedAt && prev.updatedAt > fecha) return; // no pisar datos más recientes
    const peligros = peligrosReutilizables(data.peligros);

    map[key] = {
        fundo,
        area: (inputs.area_relacionamiento || '').trim() || prev.area || '',
        latitud: (inputs.latitud || '').trim() || prev.latitud || '',
        longitud: (inputs.longitud || '').trim() || prev.longitud || '',
        peligros: peligros.length > 0 ? peligros : (prev.peligros || []),
        updatedAt: fecha
    };
    setFundosVisitados(map);
}

// Primera vez: poblar con los formularios que ya están guardados en el equipo
export async function migrarFundosVisitados() {
    if (localStorage.getItem(FUNDOS_VISITADOS_KEY)) return;
    setFundosVisitados({});
    const list = getSavedFormsList().slice().sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
    for (const item of list) {
        try {
            const formObj = await getForm(item.id);
            if (formObj && formObj.data) registrarFundoVisitado(formObj.data, formObj.savedAt);
        } catch (e) {
            console.warn('No se pudo leer el formulario ' + item.id, e);
        }
    }
}


/**
 * Trae del servidor el último registro de cada fundo enviado por cualquier equipo y lo agrega a la lista local.
 * Un fundo local solo se reemplaza si el del servidor es más reciente; se conservan los responsables locales,
 * porque el servidor no comparte nombres de personas. Devuelve true si cambió algo.
 */
export async function descargarFundosCompartidos() {
    if (!navigator.onLine) return false;
    const res = await tryFetchWithFallback('/api/fundos-visitados');
    let fundosServidor;
    try {
        fundosServidor = res.ok ? (await res.json()).fundos : null;
    } catch (e) {
        return false; // servidor antiguo sin este servicio
    }
    if (!Array.isArray(fundosServidor)) return false;

    const map = getFundosVisitados();
    let cambios = false;
    for (const f of fundosServidor) {
        const key = normalizarFundo(f.fundo);
        if (!key) continue;
        const local = map[key];
        if (local && (local.updatedAt || 0) >= (f.updatedAt || 0)) continue;

        const responsablesLocales = new Map((local?.peligros || []).map(p => [p.descripcion, p.responsables]));
        map[key] = {
            fundo: f.fundo,
            area: f.area || local?.area || '',
            latitud: f.latitud || local?.latitud || '',
            longitud: f.longitud || local?.longitud || '',
            peligros: peligrosReutilizables((f.peligros || []).map(p => ({ ...p, responsables: responsablesLocales.get(p.descripcion) || '' }))),
            updatedAt: f.updatedAt
        };
        cambios = true;
    }
    if (cambios) setFundosVisitados(map);
    return cambios;
}
