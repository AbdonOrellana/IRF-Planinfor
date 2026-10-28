// Fundos visitados por la persona que usa este equipo: datos de cada fundo donde hizo un IRF, para
// precargarlos si vuelve al mismo fundo. Solo se guardan en el equipo (funciona sin señal); no se comparten
// entre equipos.
import { getForm } from './formStore.js';
import { getSavedFormsList } from './bandeja.js';
import { tryFetchWithFallback } from './api.js';

// Guarda los datos propios de cada fundo (área, coordenadas de rescate y peligros identificados)
// para precargarlos cuando se vuelve a hacer un IRF en el mismo fundo, incluso sin conexión.
const FUNDOS_VISITADOS_KEY = 'irf_fundos_visitados';
// Las versiones 1.1.1-1.1.3 de la app mezclaban fundos de otros equipos: al cambiar de versión la lista
// se rearma solo con los formularios guardados en este equipo
const FUNDOS_VERSION_KEY = 'irf_fundos_visitados_version';
// La versión 4 guarda además el IRF completo de la última visita (equipo, participantes, etc.)
// La 5 agrega la fecha de inicio del primer IRF de cada fundo
const FUNDOS_VERSION = '5';

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

// Campos del IRF que no se reutilizan en una visita nueva: la fecha, las firmas, el peligro que se está
// escribiendo en ese momento y los campos auxiliares que se rearman solos
function esCampoDeLaVisita(id) {
    return id === 'fecha_inicio' || id === 'nombre_participante' || id === 'cargo_participante'
        || id.startsWith('firma_') || id.startsWith('peligro_') || id.endsWith('_hidden');
}

export function inputsReutilizables(inputs) {
    const limpios = {};
    Object.entries(inputs || {}).forEach(([id, valor]) => {
        if (valor && !esCampoDeLaVisita(id)) limpios[id] = valor;
    });
    return limpios;
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// La fecha de inicio del fundo es la del primer IRF que se hizo en él: se queda con la más antigua conocida
function fechaMasAntigua(a, b) {
    const validas = [a, b].filter(f => FECHA_ISO.test(f || ''));
    return validas.length ? validas.sort()[0] : '';
}

// primeraFecha: fecha de inicio del primer IRF del fundo si el origen la conoce (p. ej. el servidor)
export function registrarFundoVisitado(data, savedAt, primeraFecha) {
    const inputs = (data && data.inputs) || {};
    const fundo = (inputs.fundo_instalacion || '').trim();
    const key = normalizarFundo(fundo);
    if (!key) return;

    const map = getFundosVisitados();
    const prev = map[key] || {};
    const fecha = savedAt || Date.now();
    const fechaInicio = fechaMasAntigua(fechaMasAntigua(prev.fechaInicio, inputs.fecha_inicio), primeraFecha);
    if (prev.updatedAt && prev.updatedAt > fecha) { // no pisar datos más recientes, pero sí recordar un inicio más antiguo
        if (fechaInicio && fechaInicio !== prev.fechaInicio) {
            map[key] = { ...prev, fechaInicio };
            setFundosVisitados(map);
        }
        return;
    }
    const peligros = peligrosReutilizables(data.peligros);

    map[key] = {
        fundo,
        area: (inputs.area_relacionamiento || '').trim() || prev.area || '',
        latitud: (inputs.latitud || '').trim() || prev.latitud || '',
        longitud: (inputs.longitud || '').trim() || prev.longitud || '',
        peligros: peligros.length > 0 ? peligros : (prev.peligros || []),
        // IRF completo de la última visita, sin los peligros (se ofrecen aparte)
        irf: {
            inputs: inputsReutilizables(inputs),
            participantes: (Array.isArray(data.participantes) ? data.participantes : []).map(p => ({ ...p }))
        },
        fechaInicio,
        updatedAt: fecha
    };
    setFundosVisitados(map);
}

// Primera vez: poblar con los formularios que ya están guardados en el equipo
export async function migrarFundosVisitados() {
    if (localStorage.getItem(FUNDOS_VISITADOS_KEY) && localStorage.getItem(FUNDOS_VERSION_KEY) === FUNDOS_VERSION) return;
    // Hasta la versión 3 la lista mezclaba fundos de otros equipos: se rearma de cero. Desde la 4 solo se completa,
    // para no perder los fundos descargados del servidor si no hay señal en este momento.
    const reiniciar = !localStorage.getItem(FUNDOS_VISITADOS_KEY) || !(Number(localStorage.getItem(FUNDOS_VERSION_KEY)) >= 4);
    localStorage.setItem(FUNDOS_VERSION_KEY, FUNDOS_VERSION);
    if (reiniciar) setFundosVisitados({});
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

// Persona para la que se armó la lista actual de fundos: si cambia, la lista se reemplaza por la de la nueva persona
const FUNDOS_USUARIO_KEY = 'irf_fundos_usuario';

// Suma los fundos de los formularios guardados en este equipo donde la persona figura como jefe de faena
async function registrarFormulariosDeJefe(jefe) {
    const buscado = normalizarFundo(jefe);
    const list = getSavedFormsList().slice().sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
    for (const item of list) {
        try {
            const formObj = await getForm(item.id);
            if (formObj && formObj.data && normalizarFundo(formObj.data.inputs && formObj.data.inputs.jefe_faena) === buscado) {
                registrarFundoVisitado(formObj.data, formObj.savedAt);
            }
        } catch (e) {
            console.warn('No se pudo leer el formulario ' + item.id, e);
        }
    }
}

// Descarga del servidor los fundos donde la persona figura como jefe de faena y los suma a los de este equipo
// (sin pisar datos más recientes). Si el equipo lo usaba otra persona, la lista se reemplaza por la de esta persona
// (sus fundos del servidor y de los formularios guardados aquí). Devuelve cuántos fundos se cargaron o actualizaron.
export async function descargarFundosDeJefe(jefe) {
    if (!jefe) return 0;
    const response = await tryFetchWithFallback('/api/mis-fundos?jefe=' + encodeURIComponent(jefe));
    if (!response.ok) throw new Error('El servidor respondió HTTP ' + response.status);
    let fundos;
    try {
        ({ fundos } = await response.json());
    } catch (e) {
        // Un servidor sin esta función responde con la página de la app en vez de datos
        throw new Error('El servidor aún no tiene la función de fundos por jefe de faena (falta actualizarlo)');
    }

    // Solo se reemplaza una vez que el servidor respondió: sin señal queda la lista anterior y se reintenta al abrir la app
    const anterior = localStorage.getItem(FUNDOS_USUARIO_KEY);
    const cambioDeUsuario = !!anterior && normalizarFundo(anterior) !== normalizarFundo(jefe);
    if (cambioDeUsuario) {
        setFundosVisitados({});
        await registrarFormulariosDeJefe(jefe);
    }
    localStorage.setItem(FUNDOS_USUARIO_KEY, jefe);

    let cambios = 0;
    for (const item of Array.isArray(fundos) ? fundos : []) {
        const antes = getFundoVisitado(item.fundo);
        registrarFundoVisitado(item.data, item.updatedAt, item.primeraFecha);
        const despues = getFundoVisitado(item.fundo);
        if (despues && (!antes || antes.updatedAt !== despues.updatedAt)) cambios++;
    }
    if (cambioDeUsuario) {
        window.dispatchEvent(new Event('irf:fundos-actualizados'));
        return Object.keys(getFundosVisitados()).length;
    }
    return cambios;
}
