import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: '/api/payments/epayco/create-session' }, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('authorization');

    const epaycoPublicKey = process.env.NEXT_PUBLIC_EPAYCO_PUBLIC_KEY;
    const epaycoTestMode = process.env.EPAYCO_TEST_MODE === 'true';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://motaxi.dev';

    if (!epaycoPublicKey) {
      return NextResponse.json({ error: 'ePayco no configurado en el servidor' }, { status: 500, headers: corsHeaders });
    }

    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerRegion,
      customerTypeDoc,
      customerNumberDoc,
      userId,
    } = body;

    if (!customerEmail || !customerName || !userId) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400, headers: corsHeaders });
    }

    const sanitize = (v: any, d = '') => String(v || d).trim();

    const amount = 14900;
    const reference = `MTX-SUB-${userId.substring(0, 8)}-${Date.now()}`;

    // Tax calculation (IVA 19%)
    const taxRate = 0.19;
    const taxBase = amount / (1 + taxRate);
    const tax = amount - taxBase;

    const config = {
      key: sanitize(epaycoPublicKey),
      test: epaycoTestMode,
      name: 'Suscripción MoTaxi',
      description: 'Suscripción mensual al servicio MoTaxi',
      invoice: reference,
      currency: 'cop',
      amount: amount.toString(),
      tax_base: taxBase.toFixed(2),
      tax: tax.toFixed(2),
      country: 'co',
      lang: 'es',
      name_billing: sanitize(customerName),
      email_billing: sanitize(customerEmail).toLowerCase(),
      mobilephone_billing: sanitize(customerPhone),
      address_billing: sanitize(customerAddress, 'Sin especificar'),
      city_billing: sanitize(customerCity, 'Sibundoy'),
      type_doc_billing: sanitize(customerTypeDoc, 'CC'),
      number_doc_billing: sanitize(customerNumberDoc),
      name_shipping: sanitize(customerName),
      address_shipping: sanitize(customerAddress, 'Sin especificar'),
      city_shipping: sanitize(customerCity, 'Sibundoy'),
      type_doc_shipping: sanitize(customerTypeDoc, 'CC'),
      mobilephone_shipping: sanitize(customerPhone),
      extra1: userId,
      extra2: reference,
      extra3: sanitize(customerRegion),
      response: `${siteUrl}/respuesta-pago`,
      confirmation: `${siteUrl}/api/payments/epayco/confirmation`,
      external: 'false',
      autoclick: false,
      method_confirmation: 'POST',
      methodsDisable: [],
    };

    return NextResponse.json({ success: true, config, reference }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('ePayco create-session error:', error);
    return NextResponse.json({ error: 'Error interno del servidor', details: error.message }, { status: 500, headers: corsHeaders });
  }
}
