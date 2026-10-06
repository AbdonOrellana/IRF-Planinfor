import './env.js';
import crypto from 'crypto';

// ------------------ Contraseñas (scrypt con sal aleatoria) ------------------
// Formato guardado: scrypt$<salt hex>$<hash hex>

const KEY_LENGTH = 64;

export function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(String(password), salt, KEY_LENGTH);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
    const [scheme, saltHex, hashHex] = String(stored || '').split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
}

// ------------------ Tokens de sesión (JWT HS256) ------------------

const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 horas

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    jwtSecret = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️ JWT_SECRET no está definido en .env: se usa uno temporal y las sesiones se cerrarán al reiniciar el servidor.');
}

const b64url = (input) => Buffer.from(input).toString('base64url');

function sign(data) {
    return crypto.createHmac('sha256', jwtSecret).update(data).digest('base64url');
}

export function signToken(user) {
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = b64url(JSON.stringify({ sub: user.username, role: user.rol, iat: now, exp: now + TOKEN_TTL_SECONDS }));
    return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifyToken(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expected = Buffer.from(sign(`${header}.${payload}`));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

    try {
        const { alg } = JSON.parse(Buffer.from(header, 'base64url').toString());
        if (alg !== 'HS256') return null;
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
        return claims;
    } catch (e) {
        return null;
    }
}

// Middleware: exige "Authorization: Bearer <token>" válido
export function requireAuth(req, res, next) {
    const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    const claims = match && verifyToken(match[1]);
    if (!claims) {
        return res.status(401).json({ error: 'Sesión inválida o expirada. Inicie sesión nuevamente.' });
    }
    req.user = claims;
    next();
}
