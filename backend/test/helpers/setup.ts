import { afterEach, beforeEach, vi } from 'vitest';

// Las pruebas no deben salir a internet (Expo push, Telegram, Google, Resend...).
// Cualquier fetch saliente responde vacío y queda registrado para poder verificarlo.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }))
  );
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
