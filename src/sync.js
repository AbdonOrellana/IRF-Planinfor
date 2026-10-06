// Envío de formularios al servidor: manual, automático (al recuperar señal, al volver a la app y cada 5 minutos)
// y respaldo/restauración de pendientes en archivo.
// No dibuja la pantalla: avisa con eventos que escucha main.js
//   irf:bandeja-actualizada   cambió el estado de algún formulario (o la conexión)
//   irf:formularios-enviados  se envió al menos un formulario
//   irf:fundos-actualizados   cambió la lista de fundos visitados
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { saveAs } from 'file-saver';
import { getForm, putForm } from './formStore.js';
import { getSavedFormsList, setSavedFormsList, actualizarEntradaIndice, getFormulariosPendientes } from './bandeja.js';
import { tryFetchWithFallback } from './api.js';
import { compactarFormularioParaSync, prepararEnvioConFotos } from './fotos.js';
import { registrarFundoVisitado, descargarFundosCompartidos } from './fundosVisitados.js';
import { showToast } from './utils.js';

function notificarBandeja() {
    window.dispatchEvent(new Event('irf:bandeja-actualizada'));
}

// Sube primero las fotos que falten y luego el formulario con referencias.
// Si entre medio el servidor dice que falta alguna foto (409), se reintenta una vez.
async function enviarFormulario(formObj) {
    for (let intento = 0; intento < 2; intento++) {
        const payload = await prepararEnvioConFotos(formObj);
        const response = await tryFetchWithFallback('/api/sync', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (response.status !== 409 || intento === 1) return response;
    }
}

let sincronizacionEnCurso = false;

// Envía al servidor los formularios pendientes. Con { silencioso: true } (sincronización automática)
// solo avisa si algo se envió; los errores quedan visibles en la bandeja.
export async function sincronizarTodos(directFormObj, { silencioso = false } = {}) {
    if (sincronizacionEnCurso) {
        if (!silencioso) showToast('Ya hay una sincronización en curso...', 'info');
        return;
    }
    sincronizacionEnCurso = true;
    try {
        await sincronizarPendientes(directFormObj, silencioso);
    } finally {
        sincronizacionEnCurso = false;
        notificarBandeja();
    }
}

async function sincronizarPendientes(directFormObj, silencioso) {
    const pendientes = getFormulariosPendientes();
    if (directFormObj && directFormObj.id && !pendientes.some(p => p.id === directFormObj.id)) {
        pendientes.unshift({ id: directFormObj.id, savedAt: directFormObj.savedAt });
    }

    if (pendientes.length === 0) {
        if (!silencioso) showToast('No hay formularios pendientes de envío', 'info');
        return;
    }
    if (!silencioso) showToast('Iniciando sincronización con el servidor...', 'info');

    let countSuccess = 0;
    let lastErrorMsg = '';

    for (const item of pendientes) {
        const formObj = (directFormObj && directFormObj.id === item.id) ? directFormObj : await getForm(item.id);
        if (!formObj) continue;
        const savedAtEnviado = formObj.savedAt;

        try {
            if (await compactarFormularioParaSync(formObj)) {
                await putForm(formObj).catch(e => console.warn('No se pudo guardar la versión compactada del formulario', e));
            }
            const response = await enviarFormulario(formObj);

            if (response.ok) {
                countSuccess++;
                actualizarEntradaIndice(item.id, { synced: true, syncedAt: new Date().toISOString(), lastError: null, lastAttemptAt: Date.now() }, savedAtEnviado);
            } else {
                const errTxt = await response.text();
                let detalle = errTxt;
                try { detalle = JSON.parse(errTxt).error || errTxt; } catch (e) { /* texto plano */ }
                lastErrorMsg = `El servidor rechazó el envío (HTTP ${response.status}): ${detalle}`.slice(0, 200);
                actualizarEntradaIndice(item.id, { lastError: lastErrorMsg, lastAttemptAt: Date.now() });
                console.error('Servidor retornó error al sincronizar ' + item.id, errTxt);
            }
        } catch (err) {
            const mensaje = err.message || String(err);
            const esErrorDeRed = err.name === 'TypeError' || /failed to fetch|network/i.test(mensaje);
            lastErrorMsg = (esErrorDeRed ? 'Sin conexión con el servidor. Se reintentará automáticamente.' : mensaje).slice(0, 200);
            actualizarEntradaIndice(item.id, { lastError: lastErrorMsg, lastAttemptAt: Date.now() });
            console.error('Error de red al sincronizar formulario ' + item.id, err);
        }
    }

    if (countSuccess > 0) {
        const sufijo = silencioso ? ' automáticamente' : '';
        showToast(`✅ ${countSuccess} de ${pendientes.length} formularios enviados${sufijo} al servidor.`, 'success');
        window.dispatchEvent(new Event('irf:formularios-enviados'));
    } else if (!silencioso) {
        showToast(`⚠️ No se pudo sincronizar: ${lastErrorMsg || 'Error de conexión'}`, 'danger');
    }
}

// ------------------ SINCRONIZACIÓN AUTOMÁTICA ------------------
// Reintenta enviar los pendientes al recuperar señal, al volver a la app, al abrirla y cada 5 minutos.
const INTERVALO_SYNC_AUTO_MS = 5 * 60 * 1000;

export function sincronizarAutomaticamente() {
    if (!navigator.onLine || getFormulariosPendientes().length === 0) return;
    sincronizarTodos(null, { silencioso: true }).catch(e => console.warn('Sincronización automática falló:', e));
}

export function iniciarSincronizacionAutomatica() {
    window.addEventListener('online', () => {
        notificarBandeja();
        sincronizarAutomaticamente();
        descargarFundosCompartidos().then(c => c && window.dispatchEvent(new Event('irf:fundos-actualizados'))).catch(() => {});
    });
    window.addEventListener('offline', notificarBandeja);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') sincronizarAutomaticamente();
    });
    setInterval(sincronizarAutomaticamente, INTERVALO_SYNC_AUTO_MS);
    setTimeout(sincronizarAutomaticamente, 5000);
}

// ------------------ RESPALDO DE FORMULARIOS PENDIENTES ------------------
// Exporta a un archivo los formularios que aún no llegan al servidor, por si el equipo se pierde o falla.
export async function exportarRespaldo() {
    const pendientes = getFormulariosPendientes();
    if (pendientes.length === 0) {
        showToast('No hay formularios pendientes: todo está en el servidor.', 'info');
        return;
    }

    const formularios = [];
    for (const item of pendientes) {
        const formObj = await getForm(item.id);
        if (formObj) formularios.push(formObj);
    }
    const respaldo = {
        tipo: 'irf-respaldo',
        version: 1,
        exportadoEn: new Date().toISOString(),
        formularios
    };
    const contenido = JSON.stringify(respaldo);
    const ahora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const nombreArchivo = `respaldo-irf-${ahora.getFullYear()}${pad(ahora.getMonth() + 1)}${pad(ahora.getDate())}-${pad(ahora.getHours())}${pad(ahora.getMinutes())}.json`;

    try {
        if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
            const archivo = await Filesystem.writeFile({
                path: nombreArchivo,
                data: contenido,
                directory: Directory.Cache,
                encoding: Encoding.UTF8
            });
            await Share.share({
                title: 'Respaldo IRF',
                text: `Respaldo de ${formularios.length} formulario(s) IRF pendientes`,
                files: [archivo.uri],
                dialogTitle: 'Guardar o enviar respaldo'
            });
        } else {
            saveAs(new Blob([contenido], { type: 'application/json' }), nombreArchivo);
        }
        showToast(`💾 Respaldo con ${formularios.length} formulario(s) generado.`, 'success');
    } catch (e) {
        if (/cancel/i.test(e && e.message || '')) return; // el usuario cerró el menú de compartir
        console.error('Error exportando respaldo:', e);
        showToast('⚠️ No se pudo generar el respaldo: ' + (e.message || e), 'danger');
    }
}

export function abrirRestaurarRespaldo() {
    document.getElementById('input-restaurar-respaldo')?.click();
}

// Importa un archivo de respaldo. Un formulario solo se reemplaza si el del respaldo es más reciente.
export async function restaurarRespaldo(input) {
    const archivo = input.files && input.files[0];
    input.value = '';
    if (!archivo) return;

    let respaldo;
    try {
        respaldo = JSON.parse(await archivo.text());
    } catch (e) {
        showToast('⚠️ El archivo no es un respaldo válido.', 'danger');
        return;
    }
    if (!respaldo || respaldo.tipo !== 'irf-respaldo' || !Array.isArray(respaldo.formularios)) {
        showToast('⚠️ El archivo no es un respaldo IRF.', 'danger');
        return;
    }

    let restaurados = 0;
    let omitidos = 0;
    for (const formObj of respaldo.formularios) {
        if (!formObj || !formObj.id || !formObj.data) continue;
        const actual = await getForm(formObj.id);
        if (actual && (actual.savedAt || 0) >= (formObj.savedAt || 0)) {
            omitidos++;
            continue;
        }
        await putForm(formObj);
        const list = getSavedFormsList();
        const entry = { id: formObj.id, nombre: formObj.nombre || 'IRF restaurado', savedAt: formObj.savedAt || Date.now() };
        const idx = list.findIndex(f => f.id === formObj.id);
        if (idx >= 0) list[idx] = entry; else list.push(entry);
        setSavedFormsList(list);
        registrarFundoVisitado(formObj.data, formObj.savedAt);
        restaurados++;
    }

    notificarBandeja();
    window.dispatchEvent(new Event('irf:fundos-actualizados'));
    const detalle = omitidos > 0 ? ` (${omitidos} ya estaban actualizados en el equipo)` : '';
    showToast(`📂 ${restaurados} formulario(s) restaurado(s)${detalle}.`, restaurados > 0 ? 'success' : 'info');
    if (restaurados > 0) sincronizarAutomaticamente();
}
