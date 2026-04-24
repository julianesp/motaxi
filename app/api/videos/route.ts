import { put, list, del } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function GET() {
  const { blobs } = await list({ prefix: 'videos/meta/' });

  const videos = await Promise.all(
    blobs.map(async (blob) => {
      try {
        const res = await fetch(blob.url, { cache: 'no-store' });
        return await res.json();
      } catch {
        return null;
      }
    })
  );

  return NextResponse.json(videos.filter(Boolean));
}

export async function POST(request: Request) {
  const { title, youtubeUrl } = await request.json();
  if (!title || !youtubeUrl) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  }

  const id = Date.now().toString();
  await put(`videos/meta/${id}.json`, JSON.stringify({ id, title, youtubeUrl, uploadedAt: Date.now() }), {
    access: 'public',
    allowOverwrite: true,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const { blobs } = await list({ prefix: `videos/meta/${id}.json` });
  if (blobs.length > 0) await del(blobs[0].url);

  return NextResponse.json({ ok: true });
}
