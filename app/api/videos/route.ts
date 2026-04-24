import { list, del } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function GET() {
  const { blobs } = await list({ prefix: 'videos/meta/' });

  const videos = await Promise.all(
    blobs.map(async (blob) => {
      try {
        const res = await fetch(blob.url);
        const meta = await res.json();
        return meta;
      } catch {
        return null;
      }
    })
  );

  return NextResponse.json(videos.filter(Boolean));
}

export async function DELETE(request: Request) {
  const { url } = await request.json();
  if (!url) return NextResponse.json({ error: 'Falta url' }, { status: 400 });

  await del(url);
  return NextResponse.json({ ok: true });
}
