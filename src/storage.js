import localforage from 'localforage';

// Configure localforage to use IndexedDB explicitly
localforage.config({
    name: 'MingeoIRF',
    storeName: 'formularios_irf', // Should be alphanumeric, with underscores.
    description: 'Base de datos para formularios IRF en modo offline'
});

/**
 * Guarda un formulario (borrador o finalizado)
 * @param {Object} formData 
 */
export async function saveForm(formData) {
    try {
        const id = formData.id || Date.now().toString();
        formData.id = id;
        formData.updatedAt = new Date().toISOString();
        await localforage.setItem(id, formData);
        return id;
    } catch (err) {
        console.error('Error saving form to IndexedDB:', err);
        throw err;
    }
}

/**
 * Recupera todos los formularios guardados
 */
export async function getAllForms() {
    try {
        const forms = [];
        await localforage.iterate((value, key) => {
            forms.push(value);
        });
        return forms.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (err) {
        console.error('Error getting forms from IndexedDB:', err);
        throw err;
    }
}

/**
 * Elimina un formulario específico
 * @param {string} id 
 */
export async function deleteForm(id) {
    try {
        await localforage.removeItem(id);
    } catch (err) {
        console.error('Error deleting form:', err);
        throw err;
    }
}

/**
 * Limpia toda la base de datos
 */
export async function clearAllForms() {
    try {
        await localforage.clear();
    } catch (err) {
        console.error('Error clearing forms:', err);
        throw err;
    }
}
