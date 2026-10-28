import './env.js';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizarPayload, extraerFotos, referenciasEn, rehidratar, stringifyEstable, esHashValido } from './fotos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonDbPath = path.join(__dirname, 'db.json');
const jsonUsersPath = path.join(__dirname, 'usuarios.json');
const jsonFotosDir = path.join(__dirname, 'fotos_json');

// Initialize local JSON storage fallback if needed
function getJsonDb() {
    if (!fs.existsSync(jsonDbPath)) {
        fs.writeFileSync(jsonDbPath, JSON.stringify([], null, 2), 'utf-8');
    }
    try {
        const content = fs.readFileSync(jsonDbPath, 'utf-8');
        return JSON.parse(content || '[]');
    } catch (e) {
        return [];
    }
}

function saveJsonDb(data) {
    fs.writeFileSync(jsonDbPath, JSON.stringify(data, null, 2), 'utf-8');
}

// PostgreSQL configuration
const { Pool, Client } = pg;
const dbName = process.env.DB_NAME || 'irf_db';
const pgConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: dbName,
    password: process.env.DB_PASSWORD || 'admin123',
    port: parseInt(process.env.DB_PORT || '5432', 10),
};

let pool = null;
let isPgConnected = false;

async function ensureDatabaseExists() {
    try {
        const rootClient = new Client({
            ...pgConfig,
            database: 'postgres'
        });
        await rootClient.connect();
        const checkRes = await rootClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
        if (checkRes.rowCount === 0) {
            console.log(`🔨 Creando base de datos PostgreSQL "${dbName}"...`);
            await rootClient.query(`CREATE DATABASE "${dbName}"`);
            console.log(`✅ Base de datos "${dbName}" creada con éxito.`);
        }
        await rootClient.end();
    } catch (e) {
        console.warn('⚠️ No se pudo verificar/crear la BD en postgres root:', e.message);
    }
}

export async function initDb() {
    try {
        await ensureDatabaseExists();
        pool = new Pool(pgConfig);
        // Test connection
        const client = await pool.connect();
        
        // Create table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS formularios_irf (
                id VARCHAR(100) PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                fundo_instalacion VARCHAR(255),
                faena VARCHAR(255),
                fecha_inicio VARCHAR(50),
                supervisor VARCHAR(255),
                asesor_prevencion VARCHAR(255),
                cant_participantes INT DEFAULT 0,
                cant_peligros INT DEFAULT 0,
                version INT DEFAULT 1,
                version_history JSONB DEFAULT '[]'::jsonb,
                synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                data_payload JSONB NOT NULL,
                is_deleted BOOLEAN DEFAULT FALSE
            );
        `);

        // Migration to add columns if table existed without them
        await client.query(`
            ALTER TABLE formularios_irf ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
            ALTER TABLE formularios_irf ADD COLUMN IF NOT EXISTS version_history JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE formularios_irf ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS fotos (
                hash CHAR(64) PRIMARY KEY,
                data TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                username VARCHAR(100) PRIMARY KEY,
                password_hash VARCHAR(255) NOT NULL,
                rol VARCHAR(50) NOT NULL DEFAULT 'prevencionista',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        client.release();
        isPgConnected = true;
        console.log(`✅ PostgreSQL conectado exitosamente a "${dbName}" y tabla "formularios_irf" (con versiones) lista.`);
        await migrarFotosExistentes();
    } catch (err) {
        isPgConnected = false;
        console.warn('⚠️ No se pudo conectar a PostgreSQL. Usando almacenamiento local JSON en server/db.json como respaldo.');
        console.warn('   Mensaje de error:', err.message);
        getJsonDb(); // ensure file exists
    }
}

/**
 * Busca un registro existente por ID o por clave de negocio (Fundo + Faena + Fecha)
 */
async function findExistingRecord(id, fundo, faena, fecha) {
    if (isPgConnected && pool) {
        // 1. Buscar por ID exacto
        let res = await pool.query('SELECT * FROM formularios_irf WHERE id = $1', [id]);
        if (res.rows.length > 0) return res.rows[0];

        // 2. Si no coincide por ID pero fundo/faena no son vacíos, buscar por coincidencia de negocio
        if (fundo && fundo !== 'Sin fundo' && faena && faena !== 'Sin faena' && fecha) {
            res = await pool.query(
                'SELECT * FROM formularios_irf WHERE LOWER(fundo_instalacion) = LOWER($1) AND LOWER(faena) = LOWER($2) AND fecha_inicio = $3 ORDER BY synced_at DESC LIMIT 1',
                [fundo, faena, fecha]
            );
            if (res.rows.length > 0) return res.rows[0];
        }
        return null;
    } else {
        const db = getJsonDb();
        // 1. Buscar por ID
        let match = db.find(item => item.id === id);
        if (match) return match;

        // 2. Buscar por coincidencia de negocio
        if (fundo && fundo !== 'Sin fundo' && faena && faena !== 'Sin faena' && fecha) {
            match = db.find(item => 
                (item.fundo_instalacion || '').toLowerCase() === fundo.toLowerCase() &&
                (item.faena || '').toLowerCase() === faena.toLowerCase() &&
                item.fecha_inicio === fecha
            );
            if (match) return match;
        }
        return null;
    }
}

/**
 * Guarda o actualiza (UPSERT) un formulario IRF con control de duplicados y versiones (v1, v2...)
 */
export async function saveFormRecord(form) {
    const { id, nombre, savedAt } = form;

    // Las imágenes se guardan aparte (una sola vez) y el payload queda con referencias
    const { payload: data, fotos, referencias } = extraerFotos(normalizarPayload(form.data));
    await guardarFotos(fotos);
    const faltantes = await fotosFaltantes([...referencias]);
    if (faltantes.length > 0) {
        const err = new Error('El formulario hace referencia a fotos que no están en el servidor');
        err.code = 'FOTOS_FALTANTES';
        err.faltantes = faltantes;
        throw err;
    }

    const inputs = data?.inputs || {};
    const fundo = inputs.fundo_instalacion || inputs.nombre_eess || 'Sin fundo';
    const faena = inputs.estados_proyecto || 'Sin faena';
    const fecha = inputs.fecha_inicio || new Date().toISOString().split('T')[0];
    const supervisor = inputs.supervisor || '';
    const asesor = inputs.asesor_prev_riesgos || '';
    const cantParticipantes = Array.isArray(data?.participantes) ? data.participantes.length : 0;
    const cantPeligros = Array.isArray(data?.peligros) ? data.peligros.length : 0;
    const syncedAt = new Date().toISOString();

    const existing = await findExistingRecord(id, fundo, faena, fecha);

    if (existing) {
        // Extraer payload de datos previo (Postgres usa data_payload, JSON db usa data_payload)
        const existingData = existing.data_payload || existing.data;
        const isIdentical = stringifyEstable(existingData) === stringifyEstable(data);

        // Si los datos son exactamente idénticos (re-intento de red / paquete duplicado), omitir creación de nueva versión
        if (isIdentical) {
            console.log(`ℹ️ [Sync] Formulario sin cambios detectado (ID: ${existing.id}). Se omite duplicado.`);
            return {
                id: existing.id,
                nombre: existing.nombre,
                fundo_instalacion: existing.fundo_instalacion || fundo,
                faena: existing.faena || faena,
                fecha_inicio: existing.fecha_inicio || fecha,
                supervisor: existing.supervisor || supervisor,
                asesor_prevencion: existing.asesor_prevencion || asesor,
                cant_participantes: existing.cant_participantes || cantParticipantes,
                cant_peligros: existing.cant_peligros || cantPeligros,
                version: existing.version || 1,
                version_history: existing.version_history || [],
                synced_at: existing.synced_at || syncedAt,
                data_payload: existingData
            };
        }

        // ES UNA EDICIÓN: Incrementar versión (v2, v3...) y guardar historial previo
        const currentVersion = parseInt(existing.version || 1, 10);
        const newVersion = currentVersion + 1;
        const previousHistory = Array.isArray(existing.version_history) ? existing.version_history : [];

        const historySnapshot = {
            version: currentVersion,
            saved_at: existing.saved_at || existing.synced_at,
            synced_at: existing.synced_at,
            cant_participantes: existing.cant_participantes,
            cant_peligros: existing.cant_peligros,
            data_payload: existingData
        };

        const updatedHistory = [...previousHistory, historySnapshot];
        const targetId = existing.id; // Mantener ID único canónico

        const recordPayload = {
            id: targetId,
            nombre: nombre || `IRF - ${fundo} (${fecha}) (v${newVersion})`,
            fundo_instalacion: fundo,
            faena,
            fecha_inicio: fecha,
            supervisor,
            asesor_prevencion: asesor,
            cant_participantes: cantParticipantes,
            cant_peligros: cantPeligros,
            version: newVersion,
            version_history: updatedHistory,
            saved_at: savedAt || syncedAt,
            synced_at: syncedAt,
            data_payload: data
        };

        if (isPgConnected && pool) {
            const query = `
                UPDATE formularios_irf SET
                    nombre = $1,
                    fundo_instalacion = $2,
                    faena = $3,
                    fecha_inicio = $4,
                    supervisor = $5,
                    asesor_prevencion = $6,
                    cant_participantes = $7,
                    cant_peligros = $8,
                    version = $9,
                    version_history = $10,
                    synced_at = CURRENT_TIMESTAMP,
                    data_payload = $11
                WHERE id = $12;
            `;
            await pool.query(query, [
                recordPayload.nombre,
                fundo,
                faena,
                fecha,
                supervisor,
                asesor,
                cantParticipantes,
                cantPeligros,
                newVersion,
                JSON.stringify(updatedHistory),
                JSON.stringify(data),
                targetId
            ]);
        } else {
            const db = getJsonDb();
            const idx = db.findIndex(item => item.id === targetId);
            if (idx >= 0) {
                db[idx] = recordPayload;
            } else {
                db.push(recordPayload);
            }
            saveJsonDb(db);
        }

        console.log(`✅ [Sync] Formulario actualizado a v${newVersion} (ID: ${targetId}). Historial guardado.`);
        return recordPayload;

    } else {
        // REGISTRO NUEVO (v1)
        const recordPayload = {
            id,
            nombre: nombre || `IRF - ${fundo} (${fecha})`,
            fundo_instalacion: fundo,
            faena,
            fecha_inicio: fecha,
            supervisor,
            asesor_prevencion: asesor,
            cant_participantes: cantParticipantes,
            cant_peligros: cantPeligros,
            version: 1,
            version_history: [],
            saved_at: savedAt || syncedAt,
            synced_at: syncedAt,
            data_payload: data
        };

        if (isPgConnected && pool) {
            const query = `
                INSERT INTO formularios_irf 
                (id, nombre, fundo_instalacion, faena, fecha_inicio, supervisor, asesor_prevencion, cant_participantes, cant_peligros, version, version_history, synced_at, data_payload)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, $12);
            `;
            await pool.query(query, [
                id,
                recordPayload.nombre,
                fundo,
                faena,
                fecha,
                supervisor,
                asesor,
                cantParticipantes,
                cantPeligros,
                1,
                JSON.stringify([]),
                JSON.stringify(data)
            ]);
        } else {
            const db = getJsonDb();
            db.push(recordPayload);
            saveJsonDb(db);
        }

        console.log(`✅ [Sync] Nuevo formulario v1 guardado (ID: ${id}).`);
        return recordPayload;
    }
}

/**
 * Obtiene todos los formularios sincronizados
 */
// Historial sin los datos completos de cada versión (solo número, fechas y cantidades)
function resumirHistorial(history) {
    return (Array.isArray(history) ? history : []).map(({ data_payload, ...meta }) => meta);
}

/**
 * Lista de formularios sincronizados: solo el resumen que muestra la tabla.
 * El contenido completo (fotos, firmas, historial) se pide por ID con getFormRecordById.
 */
export async function getAllFormRecords() {
    if (isPgConnected && pool) {
        const res = await pool.query(`
            SELECT id, nombre, fundo_instalacion, faena, fecha_inicio, supervisor, asesor_prevencion,
                   data_payload->'inputs'->>'jefe_faena' AS jefe_faena,
                   cant_participantes, cant_peligros, version, synced_at,
                   COALESCE((SELECT jsonb_agg(h - 'data_payload') FROM jsonb_array_elements(version_history) h), '[]'::jsonb) AS version_history
            FROM formularios_irf
            WHERE is_deleted IS NOT TRUE
            ORDER BY synced_at DESC
        `);
        return res.rows.map(row => ({ ...row, version: row.version || 1 }));
    } else {
        const db = getJsonDb();
        return db.filter(f => !f.is_deleted).sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at)).map(row => ({
            id: row.id,
            nombre: row.nombre,
            fundo_instalacion: row.fundo_instalacion,
            faena: row.faena,
            fecha_inicio: row.fecha_inicio,
            supervisor: row.supervisor,
            asesor_prevencion: row.asesor_prevencion,
            jefe_faena: row.data_payload?.inputs?.jefe_faena || null,
            cant_participantes: row.cant_participantes,
            cant_peligros: row.cant_peligros,
            version: row.version || 1,
            version_history: resumirHistorial(row.version_history),
            synced_at: row.synced_at
        }));
    }
}

const normalizarTexto = (t) => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Nombres de quienes figuran como jefe de faena en algún IRF (para elegir el usuario de un equipo).
 * Un mismo nombre escrito con distinto uso de mayúsculas o espacios cuenta como uno solo.
 */
export async function getJefesDeFaena() {
    let filas;
    if (isPgConnected && pool) {
        const res = await pool.query(`
            SELECT TRIM(data_payload->'inputs'->>'jefe_faena') AS jefe, COUNT(*)::int AS cantidad
            FROM formularios_irf
            WHERE is_deleted IS NOT TRUE AND TRIM(COALESCE(data_payload->'inputs'->>'jefe_faena', '')) <> ''
            GROUP BY 1
        `);
        filas = res.rows;
    } else {
        const cuenta = new Map();
        for (const f of getJsonDb().filter(f => !f.is_deleted)) {
            const jefe = String(f.data_payload?.inputs?.jefe_faena || '').trim();
            if (jefe) cuenta.set(jefe, (cuenta.get(jefe) || 0) + 1);
        }
        filas = [...cuenta].map(([jefe, cantidad]) => ({ jefe, cantidad }));
    }

    // Se muestra la forma más usada de cada nombre
    const porNombre = new Map();
    for (const { jefe, cantidad } of filas) {
        const clave = normalizarTexto(jefe);
        const actual = porNombre.get(clave);
        if (!actual) porNombre.set(clave, { jefe, cantidad, total: cantidad });
        else {
            actual.total += cantidad;
            if (cantidad > actual.cantidad) { actual.jefe = jefe; actual.cantidad = cantidad; }
        }
    }
    return [...porNombre.values()].map(x => x.jefe).sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Fundos donde la persona figura como jefe de faena: el IRF más reciente de cada fundo, sin fotos ni firmas.
 * Con esto la app precarga en un equipo solo los fundos de quien lo usa.
 */
export async function getFundosDeJefe(jefe) {
    const buscado = normalizarTexto(jefe);
    if (!buscado) return [];

    let filas;
    if (isPgConnected && pool) {
        const res = await pool.query(`
            SELECT fundo_instalacion, fecha_inicio, synced_at, data_payload
            FROM formularios_irf
            WHERE is_deleted IS NOT TRUE
              AND LOWER(REGEXP_REPLACE(TRIM(data_payload->'inputs'->>'jefe_faena'), '\\s+', ' ', 'g')) = $1
            ORDER BY synced_at DESC
        `, [buscado]);
        filas = res.rows;
    } else {
        filas = getJsonDb()
            .filter(f => !f.is_deleted && normalizarTexto(f.data_payload?.inputs?.jefe_faena) === buscado)
            .sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at));
    }

    const porFundo = new Map();
    for (const fila of filas) {
        const fundo = (fila.data_payload?.inputs?.fundo_instalacion || '').trim();
        const clave = normalizarTexto(fundo);
        if (!clave) continue;

        // Fecha de inicio del primer IRF del fundo (las fechas AAAA-MM-DD se comparan como texto)
        const existente = porFundo.get(clave);
        if (existente) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(fila.fecha_inicio || '') && (!existente.primeraFecha || fila.fecha_inicio < existente.primeraFecha)) {
                existente.primeraFecha = fila.fecha_inicio;
            }
            continue; // vienen del más nuevo al más antiguo
        }
        const { inputs = {}, participantes = [], peligros = [] } = fila.data_payload;
        const inputsSinFirmas = Object.fromEntries(Object.entries(inputs).filter(([id]) => !id.startsWith('firma_')));
        const fechaVisita = Date.parse(fila.fecha_inicio);
        porFundo.set(clave, {
            fundo,
            primeraFecha: /^\d{4}-\d{2}-\d{2}$/.test(fila.fecha_inicio || '') ? fila.fecha_inicio : '',
            updatedAt: Number.isNaN(fechaVisita) ? new Date(fila.synced_at).getTime() : fechaVisita,
            data: {
                inputs: inputsSinFirmas,
                participantes,
                peligros: peligros.map(({ fotoBase64, firma_sup, ...resto }) => resto)
            }
        });
    }
    return [...porFundo.values()];
}

/**
 * Obtiene un formulario por ID
 */
export async function getFormRecordById(id) {
    let row;
    if (isPgConnected && pool) {
        const res = await pool.query('SELECT * FROM formularios_irf WHERE id = $1 AND is_deleted IS NOT TRUE', [id]);
        row = res.rows[0];
    } else {
        row = getJsonDb().find(f => f.id === id && !f.is_deleted);
    }
    if (!row) return null;

    const registro = {
        id: row.id,
        nombre: row.nombre,
        fundo_instalacion: row.fundo_instalacion,
        faena: row.faena,
        fecha_inicio: row.fecha_inicio,
        supervisor: row.supervisor,
        asesor_prevencion: row.asesor_prevencion,
        cant_participantes: row.cant_participantes,
        cant_peligros: row.cant_peligros,
        version: row.version || 1,
        version_history: row.version_history || [],
        synced_at: row.synced_at,
        data: row.data_payload
    };
    const fotos = await obtenerFotos([...referenciasEn([registro.data, registro.version_history])]);
    registro.data = rehidratar(registro.data, fotos);
    registro.version_history = rehidratar(registro.version_history, fotos);
    return registro;
}

/**
 * Elimina un formulario por ID
 */
export async function deleteFormRecord(id) {
    if (isPgConnected && pool) {
        await pool.query('UPDATE formularios_irf SET is_deleted = TRUE WHERE id = $1', [id]);
    } else {
        let db = getJsonDb();
        const idx = db.findIndex(f => f.id === id);
        if (idx >= 0) {
            db[idx].is_deleted = true;
            saveJsonDb(db);
        }
    }
}

// ------------------ USUARIOS ------------------

function getJsonUsers() {
    try {
        return JSON.parse(fs.readFileSync(jsonUsersPath, 'utf-8') || '[]');
    } catch (e) {
        return [];
    }
}

function saveJsonUsers(users) {
    fs.writeFileSync(jsonUsersPath, JSON.stringify(users, null, 2), 'utf-8');
}

export async function findUser(username) {
    if (isPgConnected && pool) {
        const res = await pool.query('SELECT username, password_hash, rol FROM usuarios WHERE username = $1', [username]);
        return res.rows[0] || null;
    }
    return getJsonUsers().find(u => u.username === username) || null;
}

export async function listUsers() {
    if (isPgConnected && pool) {
        const res = await pool.query('SELECT username, rol, created_at FROM usuarios ORDER BY username');
        return res.rows;
    }
    return getJsonUsers().map(({ username, rol, created_at }) => ({ username, rol, created_at }));
}

/**
 * Crea el usuario o, si ya existe, actualiza su contraseña y rol
 */
export async function saveUser(username, passwordHash, rol = 'prevencionista') {
    if (isPgConnected && pool) {
        await pool.query(`
            INSERT INTO usuarios (username, password_hash, rol) VALUES ($1, $2, $3)
            ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = EXCLUDED.rol
        `, [username, passwordHash, rol]);
        return;
    }
    const users = getJsonUsers();
    const existing = users.find(u => u.username === username);
    if (existing) {
        existing.password_hash = passwordHash;
        existing.rol = rol;
    } else {
        users.push({ username, password_hash: passwordHash, rol, created_at: new Date().toISOString() });
    }
    saveJsonUsers(users);
}

export async function deleteUser(username) {
    if (isPgConnected && pool) {
        const res = await pool.query('DELETE FROM usuarios WHERE username = $1', [username]);
        return res.rowCount > 0;
    }
    const users = getJsonUsers();
    const remaining = users.filter(u => u.username !== username);
    saveJsonUsers(remaining);
    return remaining.length !== users.length;
}

export async function closeDb() {
    if (pool) await pool.end();
}

// ------------------ FOTOS ------------------

async function guardarFotos(fotos) {
    if (!fotos || fotos.size === 0) return;
    if (isPgConnected && pool) {
        for (const [hash, data] of fotos) {
            await pool.query('INSERT INTO fotos (hash, data) VALUES ($1, $2) ON CONFLICT (hash) DO NOTHING', [hash, data]);
        }
        return;
    }
    fs.mkdirSync(jsonFotosDir, { recursive: true });
    for (const [hash, data] of fotos) {
        const file = path.join(jsonFotosDir, hash + '.txt');
        if (!fs.existsSync(file)) fs.writeFileSync(file, data, 'utf-8');
    }
}

export async function guardarFoto(hash, data) {
    await guardarFotos(new Map([[hash, data]]));
}

/**
 * De una lista de hashes, devuelve los que el servidor todavía no tiene
 */
export async function fotosFaltantes(hashes) {
    const validos = [...new Set(hashes)].filter(esHashValido);
    if (validos.length === 0) return [];
    if (isPgConnected && pool) {
        const res = await pool.query('SELECT hash FROM fotos WHERE hash = ANY($1::char(64)[])', [validos]);
        const existentes = new Set(res.rows.map(r => r.hash));
        return validos.filter(h => !existentes.has(h));
    }
    return validos.filter(h => !fs.existsSync(path.join(jsonFotosDir, h + '.txt')));
}

async function obtenerFotos(hashes) {
    const fotos = new Map();
    const validos = [...new Set(hashes)].filter(esHashValido);
    if (validos.length === 0) return fotos;
    if (isPgConnected && pool) {
        const res = await pool.query('SELECT hash, data FROM fotos WHERE hash = ANY($1::char(64)[])', [validos]);
        res.rows.forEach(r => fotos.set(r.hash, r.data));
        return fotos;
    }
    for (const h of validos) {
        const file = path.join(jsonFotosDir, h + '.txt');
        if (fs.existsSync(file)) fotos.set(h, fs.readFileSync(file, 'utf-8'));
    }
    return fotos;
}

// Convierte los registros guardados antes de la tabla "fotos": separa las imágenes del formulario
// y de cada versión del historial, y elimina inputs.peligros_hidden. Se ejecuta al iniciar y solo
// procesa los registros que aún tienen imágenes incrustadas.
async function migrarFotosExistentes() {
    const pendientes = await pool.query(`
        SELECT id FROM formularios_irf
        WHERE data_payload::text LIKE '%data:image/%'
           OR version_history::text LIKE '%data:image/%'
           OR data_payload->'inputs' ? 'peligros_hidden'
    `);
    if (pendientes.rows.length === 0) return;
    console.log(`🔄 Separando fotos de ${pendientes.rows.length} formulario(s) existentes...`);

    for (const { id } of pendientes.rows) {
        const { rows } = await pool.query('SELECT data_payload, version_history FROM formularios_irf WHERE id = $1', [id]);
        if (!rows[0]) continue;
        const actual = extraerFotos(normalizarPayload(rows[0].data_payload));
        const historial = extraerFotos((rows[0].version_history || []).map(v => ({ ...v, data_payload: normalizarPayload(v.data_payload) })));
        await guardarFotos(new Map([...actual.fotos, ...historial.fotos]));
        await pool.query('UPDATE formularios_irf SET data_payload = $1, version_history = $2 WHERE id = $3',
            [JSON.stringify(actual.payload), JSON.stringify(historial.payload), id]);
    }
    console.log('✅ Fotos separadas.');
}
