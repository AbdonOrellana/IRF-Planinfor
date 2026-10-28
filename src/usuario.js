// Persona que usa este equipo. Con su nombre se descargan del servidor los fundos donde figura como
// jefe de faena, para precargarlos aunque después no haya señal.
import { trabajadoresMap } from './data/appData.js';
import { descargarFundosDeJefe, normalizarFundo } from './fundosVisitados.js';
import { tryFetchWithFallback } from './api.js';
import { escapeHTML } from './utils.js';

const USUARIO_KEY = 'irf_usuario';
const USUARIO_OMITIDO_KEY = 'irf_usuario_omitido';
const JEFES_CACHE_KEY = 'irf_jefes_faena';
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

// Jefes de faena que ya tienen IRF en el servidor. Sin señal (o con un servidor sin esta función)
// se usa la última lista guardada; si no hay ninguna devuelve null.
async function cargarJefesDeFaena() {
    try {
        const response = await tryFetchWithFallback('/api/jefes-faena');
        if (response.ok) {
            const { jefes } = await response.json();
            if (Array.isArray(jefes)) {
                localStorage.setItem(JEFES_CACHE_KEY, JSON.stringify(jefes));
                return jefes;
            }
        }
    } catch (e) {
        console.warn('No se pudo cargar la lista de jefes de faena:', e);
    }
    try {
        const guardada = JSON.parse(localStorage.getItem(JEFES_CACHE_KEY));
        return Array.isArray(guardada) ? guardada : null;
    } catch (e) {
        return null;
    }
}

// Muestra el selector de nombre. Primero lista a quienes ya tienen IRF como jefe de faena; el botón
// "Agregar otro usuario" lista a los demás trabajadores. Devuelve el nombre elegido, o null si se omite.
export async function elegirUsuario() {
    const overlay = document.getElementById('usuario-overlay');
    if (!overlay) return null;
    const buscar = document.getElementById('usuario-buscar');
    const lista = document.getElementById('usuario-lista');
    const omitir = document.getElementById('usuario-omitir');
    const otros = document.getElementById('usuario-otros');
    const titulo = document.getElementById('usuario-titulo');
    const mensaje = document.getElementById('usuario-mensaje');

    const jefes = await cargarJefesDeFaena();
    const clavesJefes = new Set((jefes || []).map(normalizarFundo));
    const trabajadores = Object.keys(trabajadoresMap)
        .filter(n => !clavesJefes.has(normalizarFundo(n)))
        .sort((a, b) => a.localeCompare(b, 'es'));
    // Sin lista de jefes (sin señal o servidor sin actualizar) la lista principal queda vacía y se avisa;
    // nunca se muestra a quien no figura como jefe de faena
    let verOtros = false;

    return new Promise((resolve) => {
        const cerrar = (resultado) => {
            overlay.style.display = 'none';
            buscar.removeEventListener('input', dibujar);
            omitir.removeEventListener('click', alOmitir);
            otros.removeEventListener('click', alAlternar);
            resolve(resultado);
        };
        const alOmitir = () => {
            localStorage.setItem(USUARIO_OMITIDO_KEY, '1');
            cerrar(null);
        };
        const alAlternar = () => {
            verOtros = !verOtros;
            buscar.value = '';
            dibujar();
        };

        function dibujar() {
            titulo.textContent = verOtros ? '➕ Agregar otro usuario' : '👷 ¿Quién usará este equipo?';
            mensaje.textContent = verOtros
                ? 'Elija a la persona que usará este equipo. Aún no tiene IRF como jefe de faena.'
                : jefes === null
                    ? 'No se pudo cargar la lista de jefes de faena (sin señal o servidor sin actualizar). Use "Agregar otro usuario" para elegir a otra persona.'
                    : 'Elija su nombre para cargar los fundos donde usted figura como jefe de faena.';
            otros.textContent = verOtros ? '← Volver a la lista' : '➕ Agregar otro usuario';

            const nombres = verOtros ? trabajadores : (jefes || []);
            const texto = normalizarFundo(buscar.value);
            const coincidencias = nombres.filter(n => normalizarFundo(n).includes(texto)).slice(0, MAX_COINCIDENCIAS);
            lista.innerHTML = '';
            if (coincidencias.length === 0) {
                const vacia = !verOtros && jefes !== null && jefes.length === 0;
                lista.innerHTML = `<div style="padding:12px; font-size:13px; color:var(--text-muted); font-style:italic;">${vacia ? 'Aún no hay jefes de faena con IRF.' : 'No hay nombres que coincidan.'}</div>`;
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
        otros.addEventListener('click', alAlternar);
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
