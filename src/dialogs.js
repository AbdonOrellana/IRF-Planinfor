// Diálogos modales propios (reemplazan confirm() y prompt() nativos)

/**
 * Diálogo de confirmación modal personalizado (reemplaza confirm() nativo)
 */
export function mostrarConfirmacionCustom({
    title = '¿Confirmar Acción?',
    message = '¿Está seguro de realizar esta acción?',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'warning', // 'warning' | 'danger' | 'info' | 'success'
    confirmClass = ''
} = {}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-dialog-overlay');
        const titleEl = document.getElementById('custom-dialog-title');
        const msgEl = document.getElementById('custom-dialog-message');
        const iconWrap = document.getElementById('custom-dialog-icon-wrap');
        const inputWrap = document.getElementById('custom-dialog-input-container');
        const btnConfirm = document.getElementById('custom-dialog-btn-confirm');
        const btnCancel = document.getElementById('custom-dialog-btn-cancel');

        if (!overlay) {
            resolve(confirm(message));
            return;
        }

        titleEl.textContent = title;
        msgEl.textContent = message;
        inputWrap.style.display = 'none';

        iconWrap.className = `custom-dialog-icon-wrap ${type}`;
        btnConfirm.className = `custom-btn-primary ${confirmClass || (type === 'danger' ? 'btn-danger' : '')}`;
        btnConfirm.textContent = confirmText;
        btnCancel.textContent = cancelText;

        overlay.style.display = 'flex';

        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            overlay.style.display = 'none';
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
    });
}

/**
 * Diálogo prompt modal personalizado (reemplaza prompt() nativo)
 */
export function mostrarPromptCustom({
    title = 'Configuración',
    message = 'Ingrese el valor:',
    defaultValue = '',
    confirmText = 'Guardar',
    cancelText = 'Cancelar'
} = {}) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('custom-dialog-overlay');
        const titleEl = document.getElementById('custom-dialog-title');
        const msgEl = document.getElementById('custom-dialog-message');
        const iconWrap = document.getElementById('custom-dialog-icon-wrap');
        const inputWrap = document.getElementById('custom-dialog-input-container');
        const inputEl = document.getElementById('custom-dialog-input');
        const btnConfirm = document.getElementById('custom-dialog-btn-confirm');
        const btnCancel = document.getElementById('custom-dialog-btn-cancel');

        if (!overlay) {
            resolve(prompt(message, defaultValue));
            return;
        }

        titleEl.textContent = title;
        msgEl.textContent = message;
        inputWrap.style.display = 'block';
        inputEl.value = defaultValue;

        iconWrap.className = 'custom-dialog-icon-wrap info';
        btnConfirm.className = 'custom-btn-primary';
        btnConfirm.textContent = confirmText;
        btnCancel.textContent = cancelText;

        overlay.style.display = 'flex';
        setTimeout(() => inputEl.focus(), 50);

        const handleConfirm = () => {
            const val = inputEl.value;
            cleanup();
            resolve(val);
        };

        const handleCancel = () => {
            cleanup();
            resolve(null);
        };

        const cleanup = () => {
            overlay.style.display = 'none';
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
        };

        btnConfirm.addEventListener('click', handleConfirm);
        btnCancel.addEventListener('click', handleCancel);
    });
}
