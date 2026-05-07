import { Hono } from 'hono';
import { Env } from '../index';
import { AuthUtils } from '../utils/auth';
import {
  generateChallenge,
  bufferToBase64url,
  base64urlToBuffer,
  parseAttestationObject,
  parseAuthData,
  verifyAuthenticationSignature,
} from '../utils/webauthn';

export const passkeyRoutes = new Hono<{ Bindings: Env }>();

const RP_ID = 'motaxi.dev';
const RP_NAME = 'MoTaxi';
const CHALLENGE_TTL = 300; // 5 minutos

async function requireAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'No autorizado' }, 401);
  const user = await AuthUtils.verifyToken(c.env.DB, authHeader.substring(7));
  if (!user) return c.json({ error: 'Token inválido' }, 401);
  c.set('user', user);
  await next();
}

// ── REGISTRO DE PASSKEY ───────────────────────────────────────────────────────

/**
 * POST /passkeys/register/start
 * Genera el challenge de registro. Requiere sesión activa.
 */
passkeyRoutes.post('/register/start', requireAuth, async (c) => {
  const user = c.get('user');
  const challenge = generateChallenge();
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    `INSERT INTO passkey_challenges (id, challenge, user_id, type, expires_at, created_at)
     VALUES (?, ?, ?, 'registration', ?, ?)`
  ).bind(crypto.randomUUID(), challenge, user.id, now + CHALLENGE_TTL, now).run();

  // Credenciales ya registradas por este usuario (para excluirlas)
  const existing = await c.env.DB.prepare(
    'SELECT id FROM passkey_credentials WHERE user_id = ?'
  ).bind(user.id).all();

  const excludeCredentials = (existing.results || []).map((row: any) => ({
    id: row.id,
    type: 'public-key',
    transports: ['internal'],
  }));

  return c.json({
    challenge,
    rp: { id: RP_ID, name: RP_NAME },
    user: {
      id: bufferToBase64url(new TextEncoder().encode(user.id).buffer),
      name: user.email || user.phone,
      displayName: user.full_name,
    },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // huella del dispositivo
      userVerification: 'required',
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
    excludeCredentials,
  });
});

/**
 * POST /passkeys/register/finish
 * Verifica y guarda la credencial. Requiere sesión activa.
 */
passkeyRoutes.post('/register/finish', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { id, rawId, response: credResponse, deviceName } = body;

  if (!id || !credResponse?.attestationObject || !credResponse?.clientDataJSON) {
    return c.json({ error: 'Datos de credencial incompletos' }, 400);
  }

  // Parsear clientDataJSON
  const clientDataJSON = base64urlToBuffer(credResponse.clientDataJSON);
  const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

  // Verificar type
  if (clientData.type !== 'webauthn.create') {
    return c.json({ error: 'Tipo de operación inválido' }, 400);
  }

  // Verificar challenge
  const now = Math.floor(Date.now() / 1000);
  const challengeRecord = await c.env.DB.prepare(
    `SELECT * FROM passkey_challenges
     WHERE challenge = ? AND user_id = ? AND type = 'registration' AND expires_at > ?`
  ).bind(clientData.challenge, user.id, now).first() as any;

  if (!challengeRecord) {
    return c.json({ error: 'Challenge inválido o expirado' }, 400);
  }

  // Verificar origin
  const expectedOrigins = [
    'https://motaxi.dev',
    'https://www.motaxi.dev',
    'http://localhost:3000',
  ];
  if (!expectedOrigins.includes(clientData.origin)) {
    return c.json({ error: `Origin inválido: ${clientData.origin}` }, 400);
  }

  // Parsear attestationObject y authData
  let authDataBytes: Uint8Array;
  try {
    const { authData } = parseAttestationObject(credResponse.attestationObject);
    authDataBytes = authData;
  } catch (e: any) {
    return c.json({ error: `Error parseando attestationObject: ${e.message}` }, 400);
  }

  const parsed = parseAuthData(authDataBytes);

  // Verificar flags: UP (bit 0) y UV (bit 2) deben estar activos
  if (!(parsed.flags & 0x01)) return c.json({ error: 'User Presence no verificado' }, 400);
  if (!(parsed.flags & 0x04)) return c.json({ error: 'User Verification no verificado' }, 400);

  if (!parsed.credentialId || !parsed.credentialPublicKey) {
    return c.json({ error: 'Credencial no incluida en authData' }, 400);
  }

  const credId = bufferToBase64url(parsed.credentialId.buffer);
  const publicKey = bufferToBase64url(parsed.credentialPublicKey.buffer);

  // Verificar que la credencial no exista ya
  const exists = await c.env.DB.prepare(
    'SELECT id FROM passkey_credentials WHERE id = ?'
  ).bind(credId).first();
  if (exists) return c.json({ error: 'Esta credencial ya está registrada' }, 409);

  // Guardar credencial
  await c.env.DB.prepare(
    `INSERT INTO passkey_credentials (id, user_id, public_key, counter, device_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(credId, user.id, publicKey, parsed.counter, deviceName || 'Mi dispositivo', now).run();

  // Eliminar challenge usado
  await c.env.DB.prepare('DELETE FROM passkey_challenges WHERE id = ?')
    .bind(challengeRecord.id).run();

  return c.json({ success: true, message: 'Huella registrada correctamente' });
});

// ── AUTENTICACIÓN CON PASSKEY ─────────────────────────────────────────────────

/**
 * POST /passkeys/login/start
 * Genera el challenge de autenticación. No requiere sesión.
 */
passkeyRoutes.post('/login/start', async (c) => {
  const challenge = generateChallenge();
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    `INSERT INTO passkey_challenges (id, challenge, user_id, type, expires_at, created_at)
     VALUES (?, ?, NULL, 'authentication', ?, ?)`
  ).bind(crypto.randomUUID(), challenge, now + CHALLENGE_TTL, now).run();

  return c.json({
    challenge,
    rpId: RP_ID,
    timeout: 60000,
    userVerification: 'required',
    allowCredentials: [], // vacío = el dispositivo usa sus propias credenciales
  });
});

/**
 * POST /passkeys/login/finish
 * Verifica la firma y devuelve el token de sesión.
 */
passkeyRoutes.post('/login/finish', async (c) => {
  const body = await c.req.json();
  const { id: credId, response: credResponse } = body;

  if (!credId || !credResponse?.authenticatorData || !credResponse?.clientDataJSON || !credResponse?.signature) {
    return c.json({ error: 'Datos de autenticación incompletos' }, 400);
  }

  // Parsear clientDataJSON
  const clientDataJSONBytes = base64urlToBuffer(credResponse.clientDataJSON);
  const clientData = JSON.parse(new TextDecoder().decode(clientDataJSONBytes));

  if (clientData.type !== 'webauthn.get') {
    return c.json({ error: 'Tipo de operación inválido' }, 400);
  }

  // Verificar origin
  const expectedOrigins = [
    'https://motaxi.dev',
    'https://www.motaxi.dev',
    'http://localhost:3000',
  ];
  if (!expectedOrigins.includes(clientData.origin)) {
    return c.json({ error: `Origin inválido: ${clientData.origin}` }, 400);
  }

  // Verificar challenge
  const now = Math.floor(Date.now() / 1000);
  const challengeRecord = await c.env.DB.prepare(
    `SELECT * FROM passkey_challenges
     WHERE challenge = ? AND type = 'authentication' AND expires_at > ?`
  ).bind(clientData.challenge, now).first() as any;

  if (!challengeRecord) {
    return c.json({ error: 'Challenge inválido o expirado' }, 400);
  }

  // Buscar la credencial registrada
  const credential = await c.env.DB.prepare(
    `SELECT pc.*, u.id as uid, u.email, u.full_name, u.role, u.phone
     FROM passkey_credentials pc
     JOIN users u ON pc.user_id = u.id
     WHERE pc.id = ?`
  ).bind(credId).first() as any;

  if (!credential) {
    return c.json({ error: 'Huella no reconocida. Regístrala primero en tu perfil.' }, 404);
  }

  // Parsear authData
  const authDataBytes = base64urlToBuffer(credResponse.authenticatorData);
  const parsed = parseAuthData(authDataBytes);

  // Verificar flags
  if (!(parsed.flags & 0x01)) return c.json({ error: 'User Presence no verificado' }, 400);
  if (!(parsed.flags & 0x04)) return c.json({ error: 'User Verification no verificado' }, 400);

  // Verificar counter (anti-replay)
  if (parsed.counter > 0 && parsed.counter <= credential.counter) {
    return c.json({ error: 'Contador de autenticador inválido (posible replay attack)' }, 400);
  }

  // Verificar firma
  const signatureBytes = base64urlToBuffer(credResponse.signature);
  const valid = await verifyAuthenticationSignature({
    publicKeyBase64: credential.public_key,
    authData: authDataBytes,
    clientDataJSON: clientDataJSONBytes,
    signature: signatureBytes,
  });

  if (!valid) {
    return c.json({ error: 'Firma inválida' }, 400);
  }

  // Actualizar counter y last_used_at
  await c.env.DB.prepare(
    'UPDATE passkey_credentials SET counter = ?, last_used_at = ? WHERE id = ?'
  ).bind(parsed.counter, now, credId).run();

  // Eliminar challenge usado
  await c.env.DB.prepare('DELETE FROM passkey_challenges WHERE id = ?')
    .bind(challengeRecord.id).run();

  // Crear sesión (mismo sistema que el login normal)
  const { token, expiresAt } = await AuthUtils.createSession(c.env.DB, credential.uid);

  return c.json({
    token,
    expiresAt,
    user: {
      id: credential.uid,
      email: credential.email,
      full_name: credential.full_name,
      role: credential.role,
      phone: credential.phone,
    },
  });
});

// ── GESTIÓN DE PASSKEYS DEL USUARIO ──────────────────────────────────────────

/**
 * GET /passkeys
 * Lista las passkeys del usuario autenticado
 */
passkeyRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user');
  const creds = await c.env.DB.prepare(
    `SELECT id, device_name, created_at, last_used_at
     FROM passkey_credentials WHERE user_id = ? ORDER BY created_at DESC`
  ).bind(user.id).all();
  return c.json({ passkeys: creds.results || [] });
});

/**
 * DELETE /passkeys/:credId
 * Eliminar una passkey registrada
 */
passkeyRoutes.delete('/:credId', requireAuth, async (c) => {
  const user = c.get('user');
  const credId = c.req.param('credId');

  await c.env.DB.prepare(
    'DELETE FROM passkey_credentials WHERE id = ? AND user_id = ?'
  ).bind(credId, user.id).run();

  return c.json({ success: true });
});
