/**
 * Hook para WebAuthn / Passkeys (huella digital)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

function getToken(): string {
  if (typeof document === 'undefined') return '';
  return document.cookie.match(/authToken=([^;]+)/)?.[1] || '';
}

// Convertir base64url a ArrayBuffer
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Convertir ArrayBuffer a base64url
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof navigator.credentials?.create === 'function'
  );
}

/**
 * Registrar huella digital (requiere estar autenticado)
 */
export async function registerPasskey(deviceName?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Obtener challenge del servidor
    const startRes = await fetch(`${API_URL}/passkeys/register/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
    });
    if (!startRes.ok) {
      const err = await startRes.json() as any;
      return { success: false, error: err.error || 'Error iniciando registro' };
    }
    const options = await startRes.json() as any;

    // 2. Convertir campos de base64url a ArrayBuffer
    const publicKey: PublicKeyCredentialCreationOptions = {
      ...options,
      challenge: base64urlToBuffer(options.challenge),
      user: {
        ...options.user,
        id: base64urlToBuffer(options.user.id),
      },
      excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
        ...c,
        id: base64urlToBuffer(c.id),
      })),
    };

    // 3. Pedir la huella al dispositivo
    const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
    if (!credential) return { success: false, error: 'No se obtuvo credencial del dispositivo' };

    const response = credential.response as AuthenticatorAttestationResponse;

    // 4. Enviar al servidor
    const finishRes = await fetch(`${API_URL}/passkeys/register/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        deviceName: deviceName || getDeviceName(),
        response: {
          attestationObject: bufferToBase64url(response.attestationObject),
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
        },
      }),
    });

    const result = await finishRes.json() as any;
    if (!finishRes.ok) return { success: false, error: result.error || 'Error finalizando registro' };
    return { success: true };
  } catch (err: any) {
    if (err.name === 'NotAllowedError') return { success: false, error: 'Cancelado por el usuario' };
    if (err.name === 'InvalidStateError') return { success: false, error: 'Esta huella ya está registrada' };
    return { success: false, error: err.message || 'Error desconocido' };
  }
}

/**
 * Iniciar sesión con huella digital
 * Devuelve el token y datos del usuario si es exitoso
 */
export async function loginWithPasskey(): Promise<{
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
}> {
  try {
    // 1. Obtener challenge del servidor
    const startRes = await fetch(`${API_URL}/passkeys/login/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!startRes.ok) {
      const err = await startRes.json() as any;
      return { success: false, error: err.error || 'Error iniciando autenticación' };
    }
    const options = await startRes.json() as any;

    // 2. Convertir challenge
    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: base64urlToBuffer(options.challenge),
      rpId: options.rpId,
      timeout: options.timeout,
      userVerification: options.userVerification,
      allowCredentials: (options.allowCredentials || []).map((c: any) => ({
        ...c,
        id: base64urlToBuffer(c.id),
      })),
    };

    // 3. Pedir huella
    const assertion = await navigator.credentials.get({ publicKey }) as PublicKeyCredential;
    if (!assertion) return { success: false, error: 'No se obtuvo respuesta del dispositivo' };

    const response = assertion.response as AuthenticatorAssertionResponse;

    // 4. Verificar en el servidor
    const finishRes = await fetch(`${API_URL}/passkeys/login/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: assertion.id,
        rawId: bufferToBase64url(assertion.rawId),
        type: assertion.type,
        response: {
          authenticatorData: bufferToBase64url(response.authenticatorData),
          clientDataJSON: bufferToBase64url(response.clientDataJSON),
          signature: bufferToBase64url(response.signature),
          userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
        },
      }),
    });

    const result = await finishRes.json() as any;
    if (!finishRes.ok) return { success: false, error: result.error || 'Autenticación fallida' };
    return { success: true, token: result.token, user: result.user };
  } catch (err: any) {
    if (err.name === 'NotAllowedError') return { success: false, error: 'Cancelado o huella no reconocida' };
    return { success: false, error: err.message || 'Error desconocido' };
  }
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'Dispositivo';
}
