// Administración de usuarios del panel prevencionista.
//
//   npm run usuarios -- listar
//   npm run usuarios -- crear <usuario>        (pide la contraseña; también sirve para cambiarla)
//   npm run usuarios -- eliminar <usuario>
import readline from 'readline';
import { initDb, closeDb, listUsers, saveUser, deleteUser } from './db.js';
import { hashPassword } from './auth.js';

const MIN_PASSWORD_LENGTH = 8;

function preguntarOculto(texto) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        rl._writeToOutput = (s) => {
            // No mostrar lo que se escribe, solo el texto de la pregunta
            if (s.includes(texto)) rl.output.write(s);
        };
        rl.question(texto, (respuesta) => {
            rl.close();
            process.stdout.write('\n');
            resolve(respuesta);
        });
    });
}

async function main() {
    const [accion, username] = process.argv.slice(2);
    await initDb();

    if (accion === 'listar') {
        const users = await listUsers();
        if (users.length === 0) console.log('No hay usuarios.');
        users.forEach(u => console.log(`- ${u.username} (${u.rol})`));
    } else if (accion === 'crear' && username) {
        const password = await preguntarOculto(`Contraseña para "${username}": `);
        if (password.length < MIN_PASSWORD_LENGTH) {
            throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
        }
        const repetida = await preguntarOculto('Repita la contraseña: ');
        if (password !== repetida) throw new Error('Las contraseñas no coinciden.');
        await saveUser(username, hashPassword(password));
        console.log(`✅ Usuario "${username}" guardado.`);
    } else if (accion === 'eliminar' && username) {
        console.log(await deleteUser(username) ? `✅ Usuario "${username}" eliminado.` : `No existe el usuario "${username}".`);
    } else {
        console.log('Uso:\n  npm run usuarios -- listar\n  npm run usuarios -- crear <usuario>\n  npm run usuarios -- eliminar <usuario>');
    }
}

main()
    .catch(err => {
        console.error('❌ ' + err.message);
        process.exitCode = 1;
    })
    .finally(closeDb);
