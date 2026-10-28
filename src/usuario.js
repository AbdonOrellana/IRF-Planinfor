// Persona que usa este equipo. Con su nombre se descargan del servidor los fundos donde figura como
// jefe de faena, para precargarlos aunque después no haya señal.
import { trabajadoresMap } from './data/appData.js';
import { descargarFundosDeJefe, normalizarFundo } from './fundosVisitados.js';
import { escapeHTML } from './utils.js';

const USUARIO_KEY = 'irf_usuario';
const USUARIO_OMITIDO_KEY = 'irf_usuario_omitido';
const MAX_COINCIDENCIAS = 40;

export function getUsuario() {
    return localStorage.getItem(USUARIO_KEY) || '';
}

export function setUsuario(nombre) {
    localStorage.setItem(USUARIO_KEY, nombre);
    localStorage.removeItem(USUARIO_OMITIDO_KEY);
}

export function usuarioOmitido() {
    return localStorage.getItem(USUARIO_OMITIDO_KEY) === '1';
}

// Muestra el selector de nombre. Devuelve el nombre elegido, o null si se omite.
export function elegirUsuario() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('usuario-overlay');
        const buscar = document.getElementById('usuario-buscar');
        const lista = document.getElementById('usuario-lista');
        const omitir = document.getElementById('usuario-omitir');
        if (!overlay) {
            resolve(null);
            return;
        }
        const nombres = Object.keys(trabajadoresMap).sort((a, b) => a.localeCompare(b, 'es'));

        const cerrar = (resultado) => {
            overlay.style.display = 'none';
            buscar.removeEventListener('input', dibujar);
            omitir.removeEventListener('click', alOmitir);
            resolve(resultado);
        };
        const alOmitir = () => {
            localStorage.setItem(USUARIO_OMITIDO_KEY, '1');
            cerrar(null);
        };

        function dibujar() {
            const texto = normalizarFundo(buscar.value);
            const coincidencias = nombres.filter(n => normalizarFundo(n).includes(texto)).slice(0, MAX_COINCIDENCIAS);
            lista.innerHTML = '';
            if (coincidencias.length === 0) {
                lista.innerHTML = '<div style="padding:12px; font-size:13px; color:var(--text-muted); font-style:italic;">No hay nombres que coincidan.</div>';
                return;
            }
            coincidencias.forEach(nombre => {
                const fila = document.createElement('div');
                fila.style.cssText = 'padding:12px; border-bottom:1px solid var(--border); cursor:pointer; font-size:14px;';
                fila.innerHTML = `<strong>${escapeHTML(nombre)}</strong><div style="font-size:11px; color:var(--text-muted);">${escapeHTML(trabajadoresMap[nombre] || '')}</div>`;
                fila.addEventListener('click', () => {
                    setUsuario(nombre);
                    cerrar(nombre);
                });
                lista.appendChild(fila);
            });
        }

        buscar.value = '';
        dibujar();
        buscar.addEventListener('input', dibujar);
        omitir.addEventListener('click', alOmitir);
        overlay.style.display = 'flex';
        setTimeout(() => buscar.focus(), 50);
    });
}

// Descarga los fundos del usuario elegido. Devuelve { cambios } con cuántos fundos se cargaron o actualizaron,
// o { error } si no se pudo (la app sigue funcionando con lo que ya tiene).
export async function cargarFundosDelUsuario() {
    if (!getUsuario()) return { cambios: 0 };
    if (!navigator.onLine) return { error: 'Sin conexión: no se pudieron buscar fundos nuevos.' };
    try {
        return { cambios: await descargarFundosDeJefe(getUsuario()) };
    } catch (e) {
        console.warn('No se pudieron descargar los fundos del jefe de faena:', e);
        const sinFuncion = /falta actualizarlo/.test(e.message);
        return { error: sinFuncion ? 'El servidor aún no está actualizado para cargar sus fundos.' : 'No se pudo conectar con el servidor para cargar sus fundos.' };
    }
}
