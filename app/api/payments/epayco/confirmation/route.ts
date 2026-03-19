import { NextRequest, NextResponse } from 'next/server';

// Usar variable de servidor (sin NEXT_PUBLIC_) para llamadas server-side
const API_URL = process.env.API_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Webhook de confirmación ePayco activo' });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, string> = {};

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        body[key] = value.toString();
      });
    }

    // Forward to backend Hono
    const backendResponse = await fetch(`${API_URL}/payments/epayco/confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await backendResponse.json();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('ePayco confirmation proxy error:', error);
    return NextResponse.json({ error: 'Error procesando confirmación' }, { status: 500 });
  }
}
