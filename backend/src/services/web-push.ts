/**
 * Web Push Service usando VAPID + Web Crypto API
 * Compatible con Cloudflare Workers (sin Node.js crypto)
 */

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const binary = atob(padded);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeBase64url(obj: object): string {
  const json = JSON.stringify(obj);
  const encoded = new TextEncoder().encode(json);
  return uint8ArrayToBase64url(encoded);
}

async function signVapidJWT(
  audience: string,
  subject: string,
  privateKeyBase64url: string
): Promise<string> {
  const header = encodeBase64url({ typ: 'JWT', alg: 'ES256' });
  const now = Math.floor(Date.now() / 1000);
  const payload = encodeBase64url({
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  });

  const signingInput = `${header}.${payload}`;
  const signingBytes = new TextEncoder().encode(signingInput);

  const privateKeyBytes = base64urlToUint8Array(privateKeyBase64url);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    signingBytes
  );

  return `${signingInput}.${uint8ArrayToBase64url(new Uint8Array(signature))}`;
}

async function encryptWebPushPayload(
  payload: string,
  subscriptionP256dh: string,
  subscriptionAuth: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(payload);

  // Generar par de claves efímeras del servidor
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );

  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  );

  // Importar clave pública del cliente
  const clientPublicKeyBytes = base64urlToUint8Array(subscriptionP256dh);
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    serverKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Auth secret del cliente
  const authBytes = base64urlToUint8Array(subscriptionAuth);

  // Salt aleatorio 16 bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF para derivar IKM
  const authInfo = encoder.encode('Content-Encoding: auth\0');
  const hkdfKeyMaterial = await crypto.subtle.importKey(
    'raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits']
  );
  const ikmBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: authBytes,
      info: authInfo,
    },
    hkdfKeyMaterial,
    256
  );
  const ikm = new Uint8Array(ikmBits);

  // Derivar clave de cifrado y nonce con salt
  const ikmKey = await crypto.subtle.importKey(
    'raw', ikm, { name: 'HKDF' }, false, ['deriveBits']
  );

  // content-encryption key (16 bytes)
  const cekInfo = encoder.encode('Content-Encoding: aesgcm\0');
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    ikmKey, 128
  );
  const cek = await crypto.subtle.importKey(
    'raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt']
  );

  // nonce (12 bytes)
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0');
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    ikmKey, 96
  );
  const nonce = new Uint8Array(nonceBits);

  // Padding mínimo + plaintext
  const paddedLength = plaintext.length + 2;
  const padded = new Uint8Array(paddedLength);
  padded[0] = 0; padded[1] = 0; // 2 bytes de padding length = 0
  padded.set(plaintext, 2);

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    cek,
    padded
  );

  return {
    ciphertext: new Uint8Array(encryptedBuf),
    salt,
    serverPublicKey: serverPublicKeyRaw,
  };
}

export interface WebPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface WebPushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  badge?: string;
  tag?: string;
}

export async function sendWebPush(
  subscription: WebPushSubscription,
  payload: WebPushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string = 'mailto:admin@motaxi.dev'
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await signVapidJWT(audience, vapidSubject, vapidPrivateKey);

    const payloadStr = JSON.stringify(payload);
    const { ciphertext, salt, serverPublicKey } = await encryptWebPushPayload(
      payloadStr,
      subscription.p256dh,
      subscription.auth
    );

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aesgcm',
        'Encryption': `salt=${uint8ArrayToBase64url(salt)}`,
        'Crypto-Key': `dh=${uint8ArrayToBase64url(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
        'TTL': '86400',
      },
      body: ciphertext,
    });

    if (response.status === 201 || response.status === 200) {
      return { success: true };
    }

    if (response.status === 410 || response.status === 404) {
      // Suscripción expirada — el caller debe eliminarla
      return { success: false, error: 'subscription_expired' };
    }

    const text = await response.text().catch(() => '');
    return { success: false, error: `HTTP ${response.status}: ${text}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
