import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, saveFormRecord, getAllFormRecords, getFormRecordById, deleteFormRecord } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, '..', 'dist');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support base64 canvas images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend from dist folder if built
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
}

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'IRF Sync API', timestamp: new Date().toISOString() });
});

// Auth Login Prevencionista
app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    const validUser = process.env.ADMIN_USER || 'prevencionista';
    const validPass = process.env.ADMIN_PASS || 'admin';

    if (username === validUser && password === validPass) {
        return res.json({
            success: true,
            token: 'token_irf_' + Date.now(),
            user: { username: validUser, role: 'prevencionista' }
        });
    }

    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
});

// Sincronizar un formulario individual
app.post('/api/sync', async (req, res) => {
    try {
        const formData = req.body;
        if (!formData || !formData.id) {
            return res.status(400).json({ error: 'Formulario inválido o sin ID' });
        }
        const saved = await saveFormRecord(formData);
        res.json({ success: true, message: 'Formulario sincronizado con éxito', data: saved });
    } catch (err) {
        console.error('Error sincronizando formulario:', err);
        res.status(500).json({ error: 'Error al sincronizar formulario en la base de datos', details: err.message });
    }
});

// Sincronización en lote (bulk sync)
app.post('/api/sync-batch', async (req, res) => {
    try {
        const { forms } = req.body;
        if (!Array.isArray(forms) || forms.length === 0) {
            return res.status(400).json({ error: 'Arreglo de formularios vacío o inválido' });
        }

        const synced = [];
        for (const form of forms) {
            if (form && form.id) {
                const saved = await saveFormRecord(form);
                synced.push(saved);
            }
        }

        res.json({ success: true, syncedCount: synced.length, total: forms.length, data: synced });
    } catch (err) {
        console.error('Error en sincronización por lote:', err);
        res.status(500).json({ error: 'Error procesando lote de sincronización', details: err.message });
    }
});

// Obtener todos los formularios sincronizados (Vista Prevencionista)
app.get('/api/forms', async (req, res) => {
    try {
        const records = await getAllFormRecords();
        res.json({ success: true, count: records.length, forms: records });
    } catch (err) {
        console.error('Error obteniendo formularios:', err);
        res.status(500).json({ error: 'Error al obtener formularios de la base de datos' });
    }
});

// Obtener un formulario específico por ID
app.get('/api/forms/:id', async (req, res) => {
    try {
        const record = await getFormRecordById(req.params.id);
        if (!record) {
            return res.status(404).json({ error: 'Formulario no encontrado' });
        }
        res.json({ success: true, form: record });
    } catch (err) {
        console.error('Error obteniendo formulario por ID:', err);
        res.status(500).json({ error: 'Error al consultar el formulario' });
    }
});

// Eliminar un formulario sincronizado
app.delete('/api/forms/:id', async (req, res) => {
    try {
        await deleteFormRecord(req.params.id);
        res.json({ success: true, message: 'Formulario eliminado de la base de datos' });
    } catch (err) {
        console.error('Error eliminando formulario:', err);
        res.status(500).json({ error: 'Error al eliminar el formulario' });
    }
});

// Fallback: serve index.html from dist/ or display status message
app.use((req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('<h1>Servidor IRF Sync API</h1><p>El servicio API está activo. Ejecuta <code>npm run build</code> o abre <strong>http://localhost:5173</strong> para desarrollo.</p>');
    }
});

// Inicializar DB y arrancar servidor
async function startServer() {
    await initDb();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor IRF Sync API corriendo en http://0.0.0.0:${PORT}`);
    });
}

startServer();
