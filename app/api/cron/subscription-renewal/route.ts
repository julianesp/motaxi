import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Vercel Cron envía el header Authorization con el secret configurado
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    // Obtener token de admin para autenticar la llamada al backend
    const adminToken = process.env.ADMIN_API_TOKEN;
    if (!adminToken) {
      return NextResponse.json({ error: 'ADMIN_API_TOKEN no configurado' }, { status: 500 });
    }

    const response = await fetch(`${API_URL}/admin/subscriptions/run-renewal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[cron] Error del backend:', result);
      return NextResponse.json({ error: 'Error en el backend', details: result }, { status: 500 });
    }

    console.log('[cron] Renovación ejecutada:', result);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[cron] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
