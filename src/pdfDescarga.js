// Descarga del IRF como archivo PDF en la versión web (en la app Android se usa el diálogo de impresión
// del equipo). Toma la réplica del formato (#pdf-replica-container), la dibuja como imagen y la reparte en
// hojas A4 cortando entre filas, sin partir un peligro ni una foto por la mitad.

const ANCHO_REPLICA_PX = 718;            // 190 mm: ancho útil de una hoja A4 con márgenes de 10 mm
const HOJA_MM = { ancho: 210, alto: 297, margen: 10 };
const ESCALA = 3;                         // más resolución para que el texto chico y las líneas finas se lean
const GROSOR_LINEA = 2;                   // px del lienzo: a ESCALA 3 son unos 0,5 pt

// Posiciones (en px, desde el borde superior de la réplica) donde se puede cortar una hoja
function puntosDeCorte(replica) {
    const base = replica.getBoundingClientRect().top;
    const abajoDe = (el) => Math.round(el.getBoundingClientRect().bottom - base);
    const cortes = new Set();
    replica.querySelectorAll(':scope > *, .pdf-hazards-table tbody tr, .anexo-item').forEach(el => cortes.add(abajoDe(el)));
    const anexo = replica.querySelector('.anexo-fotografico');
    // El anexo fotográfico siempre empieza en una hoja nueva
    const inicioAnexo = anexo ? Math.round(anexo.getBoundingClientRect().top - base) : null;
    return { cortes: [...cortes].sort((a, b) => a - b), inicioAnexo };
}

// Reparte la altura total en hojas: cada una termina en el último punto de corte que cabe
function repartirEnHojas(alturaTotal, alturaHoja, { cortes, inicioAnexo }) {
    const hojas = [];
    let inicio = 0;
    while (inicio < alturaTotal - 1) {
        const limite = inicio + alturaHoja;
        let fin;
        if (inicioAnexo !== null && inicioAnexo > inicio && inicioAnexo <= limite) {
            fin = inicioAnexo;
        } else if (alturaTotal <= limite) {
            fin = alturaTotal;
        } else {
            fin = [...cortes].reverse().find(c => c > inicio + 40 && c <= limite) || limite;
        }
        hojas.push([inicio, fin]);
        inicio = fin;
    }
    return hojas;
}

// Bordes de todos los elementos de la réplica, en px del lienzo. Se dibujan después de la captura
// (con el borde original transparente) para que salgan más finos que el mínimo de 1 px del navegador.
function bordesDeLaReplica(replica) {
    const base = replica.getBoundingClientRect();
    const lineas = [];
    replica.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const cs = getComputedStyle(el);
        const x = (rect.left - base.left) * ESCALA;
        const y = (rect.top - base.top) * ESCALA;
        const w = rect.width * ESCALA;
        const h = rect.height * ESCALA;
        const g = GROSOR_LINEA;
        const visible = (lado) => cs[`border${lado}Style`] !== 'none' && parseFloat(cs[`border${lado}Width`]) > 0;
        if (visible('Top')) lineas.push({ x: x - g / 2, y: y - g / 2, w: w + g, h: g, color: cs.borderTopColor });
        if (visible('Bottom')) lineas.push({ x: x - g / 2, y: y + h - g / 2, w: w + g, h: g, color: cs.borderBottomColor });
        if (visible('Left')) lineas.push({ x: x - g / 2, y: y - g / 2, w: g, h: h + g, color: cs.borderLeftColor });
        if (visible('Right')) lineas.push({ x: x + w - g / 2, y: y - g / 2, w: g, h: h + g, color: cs.borderRightColor });
    });
    return lineas;
}

export async function descargarReplicaComoPdf(replica, nombreArchivo) {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

    replica.classList.add('pdf-capture');
    try {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const alturaHoja = Math.floor((HOJA_MM.alto - 2 * HOJA_MM.margen) * ANCHO_REPLICA_PX / (HOJA_MM.ancho - 2 * HOJA_MM.margen));
        const cortes = puntosDeCorte(replica);
        const lineas = bordesDeLaReplica(replica);
        replica.classList.add('pdf-sin-bordes');
        const canvas = await html2canvas(replica, {
            scale: ESCALA,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            windowWidth: ANCHO_REPLICA_PX
        });

        const ctxPrincipal = canvas.getContext('2d');
        ctxPrincipal.setTransform(1, 0, 0, 1, 0, 0); // html2canvas deja el contexto escalado
        ctxPrincipal.globalAlpha = 1;
        lineas.forEach(l => {
            ctxPrincipal.fillStyle = l.color;
            ctxPrincipal.fillRect(Math.round(l.x), Math.round(l.y), Math.round(l.w), Math.round(l.h));
        });

        const hojas = repartirEnHojas(Math.round(canvas.height / ESCALA), alturaHoja, cortes);
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const anchoMm = HOJA_MM.ancho - 2 * HOJA_MM.margen;

        hojas.forEach(([desde, hasta], i) => {
            const recorte = document.createElement('canvas');
            recorte.width = canvas.width;
            recorte.height = Math.max(1, Math.round((hasta - desde) * ESCALA));
            const ctx = recorte.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, recorte.width, recorte.height);
            ctx.drawImage(canvas, 0, Math.round(desde * ESCALA), canvas.width, recorte.height, 0, 0, recorte.width, recorte.height);
            if (i > 0) pdf.addPage();
            pdf.addImage(recorte.toDataURL('image/jpeg', 0.92), 'JPEG', HOJA_MM.margen, HOJA_MM.margen, anchoMm, (hasta - desde) * anchoMm / ANCHO_REPLICA_PX);
        });

        pdf.save(nombreArchivo);
        return hojas.length;
    } finally {
        replica.classList.remove('pdf-capture', 'pdf-sin-bordes');
    }
}
