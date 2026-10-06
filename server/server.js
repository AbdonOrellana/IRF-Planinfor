import './env.js';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, saveFormRecord, getAllFormRecords, getFormRecordById, deleteFormRecord, findUser, saveUser, guardarFoto, fotosFaltantes, getFundosVisitados } from './db.js';
import { hashFoto, esHashValido, MAX_FOTO_CHARS } from './fotos.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from './auth.js';

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
// Hash de relleno: si el usuario no existe se verifica igual, para no revelar qué usuarios existen por el tiempo de respuesta
const DUMMY_HASH = hashPassword('usuario-inexistente');

app.post('/api/login', async (req, res) => {
    try {
        const username = String(req.body?.username || '').trim();
        const password = String(req.body?.password || '');
        const user = username ? await findUser(username) : null;
        const valid = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);

        if (user && valid) {
            return res.json({
                success: true,
                token: signToken(user),
                user: { username: user.username, role: user.rol }
            });
        }
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error al validar el usuario' });
    }
});

// Fotos: la app las sube una por una antes del formulario, así una señal débil no obliga a reenviar todo.
// Pregunta cuáles de estas fotos (por hash SHA-256) no tiene aún el servidor
app.post('/api/fotos/faltantes', async (req, res) => {
    try {
        const hashes = Array.isArray(req.body?.hashes) ? req.body.hashes.filter(esHashValido).slice(0, 500) : [];
        res.json({ faltantes: await fotosFaltantes(hashes) });
    } catch (err) {
        console.error('Error consultando fotos:', err);
        res.status(500).json({ error: 'Error consultando fotos' });
    }
});

// Sube una foto (data URL). El servidor calcula el hash; si coincide con el esperado se confirma.
app.post('/api/fotos', async (req, res) => {
    try {
        const data = req.body?.data;
        if (typeof data !== 'string' || !data.startsWith('data:image/') || data.length > MAX_FOTO_CHARS) {
            return res.status(400).json({ error: 'Foto inválida' });
        }
        const hash = hashFoto(data);
        if (req.body.hash && req.body.hash !== hash) {
            return res.status(400).json({ error: 'La foto llegó incompleta o dañada', hash });
        }
        await guardarFoto(hash, data);
        res.json({ success: true, hash });
    } catch (err) {
        console.error('Error guardando foto:', err);
        res.status(500).json({ error: 'Error guardando la foto' });
    }
});

// Fundos visitados por todos los equipos (sin fotos, firmas ni nombres) para precargar IRF en terreno
app.get('/api/fundos-visitados', async (req, res) => {
    try {
        res.json({ fundos: await getFundosVisitados() });
    } catch (err) {
        console.error('Error obteniendo fundos visitados:', err);
        res.status(500).json({ error: 'Error obteniendo fundos visitados' });
    }
});

// Sincronizar un formulario individual
app.post('/api/sync', async (req, res) => {
    try {
        const formData = req.body;
        if (!formData || !formData.id) {
            return res.status(400).json({ error: 'Formulario inválido o sin ID' });
        }
        const saved = await saveFormRecord(formData);
        // Respuesta mínima: el equipo en terreno no necesita de vuelta el formulario completo
        res.json({ success: true, message: 'Formulario sincronizado con éxito', id: saved.id, version: saved.version });
    } catch (err) {
        if (err.code === 'FOTOS_FALTANTES') {
            return res.status(409).json({ error: 'Faltan fotos del formulario en el servidor', faltantes: err.faltantes });
        }
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
app.get('/api/forms', requireAuth, async (req, res) => {
    try {
        const records = await getAllFormRecords();
        res.json({ success: true, count: records.length, forms: records });
    } catch (err) {
        console.error('Error obteniendo formularios:', err);
        res.status(500).json({ error: 'Error al obtener formularios de la base de datos' });
    }
});

// Obtener un formulario específico por ID
app.get('/api/forms/:id', requireAuth, async (req, res) => {
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
app.delete('/api/forms/:id', requireAuth, async (req, res) => {
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

// Crea los usuarios definidos en .env (ADMIN_USER/ADMIN_PASS y TEST_USER/TEST_PASS) si aún no existen.
// Para cambiar contraseñas o agregar usuarios usar: npm run usuarios
async function crearUsuariosIniciales() {
    const iniciales = [
        [process.env.ADMIN_USER, process.env.ADMIN_PASS],
        [process.env.TEST_USER, process.env.TEST_PASS]
    ];
    for (const [username, password] of iniciales) {
        if (!username || !password) continue;
        if (!(await findUser(username))) {
            await saveUser(username, hashPassword(password));
            console.log(`👤 Usuario "${username}" creado desde .env`);
        }
    }
}

// Inicializar DB y arrancar servidor
async function startServer() {
    await initDb();
    await crearUsuariosIniciales();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor IRF Sync API corriendo en http://0.0.0.0:${PORT}`);
    });
}

startServer();
