import { saveForm, getAllForms } from './storage.js';

window.guardarBorrador = async function() {
    try {
        // Recopilar datos básicos del formulario (esto es un ejemplo, se debe expandir según los campos reales)
        const area = document.getElementById('area_relacionamiento').value || '';
        const faenaSelect = document.getElementById('estados_proyecto');
        const faena = faenaSelect.options[faenaSelect.selectedIndex]?.text || '';
        const fechaInicio = document.getElementById('fecha_inicio').value || '';
        
        // Objeto con la estructura de la aplicación
        const formData = {
            status: 'draft',
            area,
            faena,
            fechaInicio,
            participantes: window.participantesList || [],
            peligros: window.peligrosList || [],
            signatures: {
                f0: document.getElementById('firma_jefe_faena_input')?.value || '',
                // ... otras firmas
            }
        };

        const id = await saveForm(formData);
        showToast('Borrador guardado localmente con éxito.', 'success');
        console.log('Saved with ID:', id);
        
        // Actualizar UI de bandeja offline si existe
        actualizarBandejaOffline();
    } catch (e) {
        showToast('Error al guardar borrador.', 'danger');
    }
};

window.guardarFinalizado = async function() {
    showToast('Validando y guardando formulario final...', 'info');
    // ... logic to validate and save as final
};

async function actualizarBandejaOffline() {
    const listContainer = document.getElementById('saved-forms-list');
    if(!listContainer) return;

    const forms = await getAllForms();
    if(forms.length === 0) {
        listContainer.innerHTML = '<div style="padding: 10px; color: var(--text-light);">No hay formularios guardados.</div>';
        return;
    }

    let html = '';
    forms.forEach(f => {
        html += `<div style="border:1px solid var(--border); padding:10px; margin-bottom:8px; border-radius:4px;">
            <strong>${f.faena || 'Sin faena'}</strong> - ${f.area || 'Sin área'} <br>
            <small>${new Date(f.updatedAt).toLocaleString()}</small>
        </div>`;
    });
    listContainer.innerHTML = html;
}

// Inicializar bandeja al cargar
document.addEventListener('DOMContentLoaded', () => {
    actualizarBandejaOffline();
});
