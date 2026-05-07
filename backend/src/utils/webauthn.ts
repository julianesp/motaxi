/**
 * Utilidades WebAuthn para Cloudflare Workers
 * Implementación manual usando Web Crypto API (sin librerías externas)
 */

// Convertir ArrayBuffer a base64url
export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convertir base64url a Uint8Array
export function base64urlToBuffer(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Generar challenge aleatorio
export function generateChallenge(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bufferToBase64url(bytes.buffer);
}

/**
 * Parsear el attestationObject CBOR (formato simplificado)
 * Extraemos authData del attestationObject que viene del cliente
 */
export function parseAttestationObject(attestationObjectBase64: string): {
  authData: Uint8Array;
} {
  const bytes = base64urlToBuffer(attestationObjectBase64);

  // El attestationObject es CBOR. Para "none" y "packed" básico,
  // buscamos el campo authData. Hacemos un parse manual de CBOR.
  // En formato CBOR map: { fmt: text, attStmt: map, authData: bytes }
  // Buscamos la secuencia de bytes que indica "authData" en CBOR
  let i = 1; // saltar el byte de map header

  function readCborItem(data: Uint8Array, offset: number): { value: any; end: number } {
    const byte = data[offset];
    const majorType = (byte & 0xe0) >> 5;
    const additionalInfo = byte & 0x1f;

    let length = additionalInfo;
    let start = offset + 1;

    if (additionalInfo === 24) { length = data[start]; start++; }
    else if (additionalInfo === 25) { length = (data[start] << 8) | data[start + 1]; start += 2; }
    else if (additionalInfo === 26) {
      length = (data[start] << 24) | (data[start + 1] << 16) | (data[start + 2] << 8) | data[start + 3];
      start += 4;
    }

    if (majorType === 2) { // bytes
      return { value: data.slice(start, start + length), end: start + length };
    }
    if (majorType === 3) { // text
      const decoder = new TextDecoder();
      return { value: decoder.decode(data.slice(start, start + length)), end: start + length };
    }
    if (majorType === 0) { // unsigned int
      return { value: length, end: start };
    }
    if (majorType === 5) { // map
      let pos = start;
      const obj: Record<string, any> = {};
      for (let k = 0; k < length; k++) {
        const key = readCborItem(data, pos);
        pos = key.end;
        const val = readCborItem(data, pos);
        pos = val.end;
        obj[key.value] = val.value;
      }
      return { value: obj, end: pos };
    }
    if (majorType === 4) { // array
      let pos = start;
      const arr: any[] = [];
      for (let k = 0; k < length; k++) {
        const item = readCborItem(data, pos);
        pos = item.end;
        arr.push(item.value);
      }
      return { value: arr, end: pos };
    }
    // fallback
    return { value: null, end: start };
  }

  const parsed = readCborItem(bytes, 0);
  if (!parsed.value || typeof parsed.value !== 'object') {
    throw new Error('attestationObject inválido');
  }

  const authData = parsed.value['authData'];
  if (!authData) throw new Error('authData no encontrado en attestationObject');

  return { authData };
}

/**
 * Parsear authData de WebAuthn
 * Estructura: rpIdHash(32) | flags(1) | counter(4) | attestedCredentialData(variable)
 */
export function parseAuthData(authData: Uint8Array): {
  rpIdHash: Uint8Array;
  flags: number;
  counter: number;
  credentialId?: Uint8Array;
  credentialPublicKey?: Uint8Array;
} {
  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32];
  const counter = (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];

  let credentialId: Uint8Array | undefined;
  let credentialPublicKey: Uint8Array | undefined;

  // AT flag (bit 6) = attested credential data presente
  if (flags & 0x40) {
    const aaguidEnd = 37 + 16;
    const credIdLen = (authData[aaguidEnd] << 8) | authData[aaguidEnd + 1];
    const credIdStart = aaguidEnd + 2;
    credentialId = authData.slice(credIdStart, credIdStart + credIdLen);
    credentialPublicKey = authData.slice(credIdStart + credIdLen);
  }

  return { rpIdHash, flags, counter, credentialId, credentialPublicKey };
}

/**
 * Verificar firma de autenticación WebAuthn
 * Soporta ES256 (COSE alg -7, P-256) — el más común en Touch ID / Android
 */
export async function verifyAuthenticationSignature(params: {
  publicKeyBase64: string;
  authData: Uint8Array;
  clientDataJSON: Uint8Array;
  signature: Uint8Array;
}): Promise<boolean> {
  const { publicKeyBase64, authData, clientDataJSON, signature } = params;

  // Hash del clientDataJSON
  const clientDataHash = await crypto.subtle.digest('SHA-256', clientDataJSON);

  // Mensaje a verificar = authData || clientDataHash
  const message = new Uint8Array(authData.length + 32);
  message.set(authData, 0);
  message.set(new Uint8Array(clientDataHash), authData.length);

  // Parsear la clave pública COSE (CBOR map con alg -7, crv 1, x, y)
  const pubKeyBytes = base64urlToBuffer(publicKeyBase64);

  // Extraer x e y del CBOR COSE_Key (formato EC2)
  // COSE key: {1: 2, 3: -7, -1: 1, -2: x(32 bytes), -3: y(32 bytes)}
  function parseCoseKey(data: Uint8Array): { x: Uint8Array; y: Uint8Array } {
    // Parse CBOR map manualmente buscando keys -2 (x) y -3 (y)
    let i = 1; // saltar map header
    const count = data[0] & 0x1f;
    let x: Uint8Array | null = null;
    let y: Uint8Array | null = null;

    function readLen(d: Uint8Array, pos: number): { len: number; next: number } {
      const b = d[pos] & 0x1f;
      if (b < 24) return { len: b, next: pos + 1 };
      if (b === 24) return { len: d[pos + 1], next: pos + 2 };
      return { len: 0, next: pos + 1 };
    }

    function skipItem(d: Uint8Array, pos: number): number {
      const major = (d[pos] & 0xe0) >> 5;
      const { len, next } = readLen(d, pos);
      if (major === 0 || major === 1) return next;
      if (major === 2 || major === 3) return next + len;
      if (major === 5) { let p = next; for (let k = 0; k < len * 2; k++) p = skipItem(d, p); return p; }
      if (major === 4) { let p = next; for (let k = 0; k < len; k++) p = skipItem(d, p); return p; }
      return next;
    }

    for (let k = 0; k < count; k++) {
      const major = (data[i] & 0xe0) >> 5;
      const { len: keyLen, next: keyNext } = readLen(data, i);

      let keyVal: number | null = null;
      if (major === 0) keyVal = keyLen; // positive int
      if (major === 1) keyVal = -(keyLen + 1); // negative int

      i = keyNext;

      const valMajor = (data[i] & 0xe0) >> 5;
      const { len: valLen, next: valNext } = readLen(data, i);

      if (keyVal === -2 && valMajor === 2) x = data.slice(valNext, valNext + valLen);
      if (keyVal === -3 && valMajor === 2) y = data.slice(valNext, valNext + valLen);

      i = skipItem(data, i);
    }

    if (!x || !y) throw new Error('Clave pública COSE inválida: x o y no encontrados');
    return { x, y };
  }

  const { x, y } = parseCoseKey(pubKeyBytes);

  // Construir clave pública en formato uncompressed para Web Crypto
  const rawKey = new Uint8Array(65);
  rawKey[0] = 0x04; // uncompressed point
  rawKey.set(x, 1);
  rawKey.set(y, 33);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  // La firma WebAuthn viene en DER, convertir a raw (r||s) para Web Crypto
  const rawSignature = derToRaw(signature);

  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    rawSignature,
    message
  );
}

/**
 * Convertir firma DER a formato raw (r||s, 64 bytes) para Web Crypto
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 len 0x02 rLen r 0x02 sLen s
  let offset = 2; // saltar 0x30 y length
  const rLen = der[offset + 1];
  let r = der.slice(offset + 2, offset + 2 + rLen);
  offset += 2 + rLen;
  const sLen = der[offset + 1];
  let s = der.slice(offset + 2, offset + 2 + sLen);

  // Quitar byte de padding 0x00 si el número empieza con bit alto
  if (r[0] === 0x00) r = r.slice(1);
  if (s[0] === 0x00) s = s.slice(1);

  // Rellenar a 32 bytes
  const raw = new Uint8Array(64);
  raw.set(r, 32 - r.length);
  raw.set(s, 64 - s.length);
  return raw;
}
