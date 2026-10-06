// Almacenamiento local de formularios en IndexedDB (vía localforage).
// localStorage tiene un límite de ~5-10 MB que se llenaba con las fotos; IndexedDB permite cientos de MB.
// El índice de la bandeja (irf_forms_index, solo metadatos) sigue en localStorage.
import localforage from 'localforage';

const store = localforage.createInstance({
    name: 'MingeoIRF',
    storeName: 'irf_formularios',
    description: 'Formularios IRF guardados en el equipo'
});

const FORM_PREFIX = 'form:';
const AUTOSAVE_KEY = 'autosave';
const LEGACY_FORM_PREFIX = 'irf_form_';
const LEGACY_AUTOSAVE_KEY = 'irf_autosave';

// Mueve los formularios que estaban en localStorage. Solo borra la copia antigua
// después de comprobar que quedó guardada en IndexedDB.
async function migrarDesdeLocalStorage() {
    const legacyKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(LEGACY_FORM_PREFIX) || key === LEGACY_AUTOSAVE_KEY)) legacyKeys.push(key);
    }

    for (const key of legacyKeys) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            const newKey = key === LEGACY_AUTOSAVE_KEY ? AUTOSAVE_KEY : FORM_PREFIX + key.slice(LEGACY_FORM_PREFIX.length);
            const existing = await store.getItem(newKey);
            if (!existing) await store.setItem(newKey, value);
            if (await store.getItem(newKey)) localStorage.removeItem(key);
        } catch (e) {
            console.warn('No se pudo migrar ' + key + ' a IndexedDB (se mantiene en localStorage):', e);
        }
    }
}

// Pide al navegador que no borre estos datos si el equipo se queda sin espacio
async function solicitarAlmacenamientoPersistente() {
    try {
        if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
            await navigator.storage.persist();
        }
    } catch (e) {
        console.warn('No se pudo solicitar almacenamiento persistente:', e);
    }
}

const ready = Promise.all([migrarDesdeLocalStorage(), solicitarAlmacenamientoPersistente()]).catch(e => {
    console.error('Error inicializando el almacenamiento local:', e);
});

export async function getForm(id) {
    await ready;
    const form = await store.getItem(FORM_PREFIX + id);
    if (form) return form;
    // Respaldo: si la migración de este formulario falló, sigue en localStorage
    const legacy = localStorage.getItem(LEGACY_FORM_PREFIX + id);
    return legacy ? JSON.parse(legacy) : null;
}

export async function putForm(formObj) {
    await ready;
    await store.setItem(FORM_PREFIX + formObj.id, formObj);
}

export async function removeForm(id) {
    await ready;
    await store.removeItem(FORM_PREFIX + id);
    localStorage.removeItem(LEGACY_FORM_PREFIX + id);
}

export async function getDraft() {
    await ready;
    return store.getItem(AUTOSAVE_KEY);
}

export async function putDraft(draft) {
    await ready;
    await store.setItem(AUTOSAVE_KEY, draft);
}
