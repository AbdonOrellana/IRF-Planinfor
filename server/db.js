import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonDbPath = path.join(__dirname, 'db.json');

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
const { Pool } = pg;
const pgConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'irf_db',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
};

let pool = null;
let isPgConnected = false;

export async function initDb() {
    try {
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
                data_payload JSONB NOT NULL
            );
        `);

        // Migration to add columns if table existed without them
        await client.query(`
            ALTER TABLE formularios_irf ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
            ALTER TABLE formularios_irf ADD COLUMN IF NOT EXISTS version_history JSONB DEFAULT '[]'::jsonb;
        `);
        
        client.release();
        isPgConnected = true;
        console.log('✅ PostgreSQL conectado exitosamente y tabla "formularios_irf" (con versiones) lista.');
    } catch (err) {
        isPgConnected = false;
        console.warn('⚠️ No se pudo conectar a PostgreSQL (detalles abajo). Usando almacenamiento local JSON en server/db.json como respaldo.');
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
    const { id, nombre, data, savedAt } = form;
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
        const isIdentical = JSON.stringify(existingData) === JSON.stringify(data);

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
export async function getAllFormRecords() {
    if (isPgConnected && pool) {
        const res = await pool.query(`
            SELECT id, nombre, fundo_instalacion, faena, fecha_inicio, supervisor, asesor_prevencion, 
                   cant_participantes, cant_peligros, version, version_history, synced_at, data_payload
            FROM formularios_irf 
            ORDER BY synced_at DESC
        `);
        return res.rows.map(row => ({
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
        }));
    } else {
        const db = getJsonDb();
        return db.sort((a, b) => new Date(b.synced_at) - new Date(a.synced_at)).map(row => ({
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
        }));
    }
}

/**
 * Obtiene un formulario por ID
 */
export async function getFormRecordById(id) {
    if (isPgConnected && pool) {
        const res = await pool.query('SELECT * FROM formularios_irf WHERE id = $1', [id]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
            id: row.id,
            nombre: row.nombre,
            version: row.version || 1,
            version_history: row.version_history || [],
            synced_at: row.synced_at,
            data: row.data_payload
        };
    } else {
        const db = getJsonDb();
        const item = db.find(f => f.id === id);
        return item ? {
            id: item.id,
            nombre: item.nombre,
            version: item.version || 1,
            version_history: item.version_history || [],
            synced_at: item.synced_at,
            data: item.data_payload
        } : null;
    }
}

/**
 * Elimina un formulario por ID
 */
export async function deleteFormRecord(id) {
    if (isPgConnected && pool) {
        await pool.query('DELETE FROM formularios_irf WHERE id = $1', [id]);
    } else {
        let db = getJsonDb();
        db = db.filter(f => f.id !== id);
        saveJsonDb(db);
    }
}
