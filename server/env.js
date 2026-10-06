// Carga la configuración desde server/.env o, si no existe, desde el .env de la raíz del proyecto.
// Así el servicio (que corre desde C:\IRF\server) y los comandos (npm run ..., desde C:\IRF) leen lo mismo.
// Importar este módulo antes que cualquier otro que use process.env.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
    path: [path.join(serverDir, '.env'), path.join(serverDir, '..', '.env')],
    quiet: true
});
