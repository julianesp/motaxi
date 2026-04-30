import { put, list } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

const BLOB_PREFIX = "analytics/page-views/";

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// POST /api/page-views — registra una visita para hoy
export async function POST() {
  const today = todayKey();
  const blobPath = `${BLOB_PREFIX}${today}.json`;

  let count = 0;
  try {
    const { blobs } = await list({ prefix: blobPath });
    if (blobs.length > 0) {
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      const data = await res.json();
      count = data.count ?? 0;
    }
  } catch {
    // primer registro del día
  }

  count += 1;

  await put(blobPath, JSON.stringify({ date: today, count }), {
    access: "public",
    allowOverwrite: true,
  });

  return NextResponse.json({ ok: true, count });
}

// GET /api/page-views — devuelve los últimos 30 días (solo admin)
export async function GET(req: NextRequest) {
  // Verificar que la petición viene del admin autenticado
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = authHeader.slice(7);

  // Validar contra el backend externo
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
  try {
    const meRes = await fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRes.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user } = await meRes.json();
    if (user?.email !== "admin@neurai.dev") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { blobs } = await list({ prefix: BLOB_PREFIX });

  const days = await Promise.all(
    blobs.map(async (blob) => {
      try {
        const res = await fetch(blob.url, { cache: "no-store" });
        return await res.json();
      } catch {
        return null;
      }
    })
  );

  const sorted = days
    .filter(Boolean)
    .sort((a: { date: string }, b: { date: string }) => (a.date > b.date ? -1 : 1))
    .slice(0, 30);

  return NextResponse.json({ views: sorted });
}
