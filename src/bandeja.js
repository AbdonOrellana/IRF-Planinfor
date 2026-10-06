// Índice de la bandeja de formularios guardados en el equipo.
// Solo metadatos (id, nombre, fechas, estado de envío) en localStorage; el contenido está en IndexedDB (formStore.js).

export function getSavedFormsList() {
    try {
        return JSON.parse(localStorage.getItem('irf_forms_index')) || [];
    } catch (e) {
        return [];
    }
}

export function setSavedFormsList(list) {
    localStorage.setItem('irf_forms_index', JSON.stringify(list));
}

// Actualiza una entrada del índice releyéndolo, para no pisar cambios hechos mientras se sincronizaba.
// Si se indica savedAt, solo se aplica si el formulario no fue modificado desde entonces.
export function actualizarEntradaIndice(id, cambios, savedAt) {
    const list = getSavedFormsList();
    const entry = list.find(f => f.id === id);
    if (!entry || (savedAt !== undefined && entry.savedAt !== savedAt)) return;
    Object.assign(entry, cambios);
    setSavedFormsList(list);
}

export function getFormulariosPendientes() {
    return getSavedFormsList().filter(item => !item.synced);
}
