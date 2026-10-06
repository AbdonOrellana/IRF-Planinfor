// Utilidades de interfaz compartidas por los módulos

export function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Mobile Animated Toast Alerts
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    
    // Limit to 2 visible toasts maximum to prevent screen clutter
    while (container.children.length >= 2) {
        container.removeChild(container.firstChild);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    if (type === 'success') icon = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    if (type === 'warning') icon = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
    if (type === 'danger') icon = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';

    toast.innerHTML = `
        <span style="font-size: 15px;">${icon}</span>
        <div>${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideInMobile 0.3s reverse forwards';
        setTimeout(() => {
            if (container.contains(toast)) toast.remove();
        }, 300);
    }, 2500);
}
