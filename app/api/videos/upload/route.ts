import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');
  const title = searchParams.get('title') || filename || 'Video';

  if (!filename || !request.body) {
    return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
  }

  const blob = await put(`videos/${filename}`, request.body, {
    access: 'public',
    addRandomSuffix: true,
    contentType: request.headers.get('content-type') || 'video/mp4',
  });

  const metaKey = `videos/meta/${blob.pathname.split('/').pop()}.json`;
  await put(metaKey, JSON.stringify({ title, url: blob.url, uploadedAt: Date.now() }), {
    access: 'public',
    allowOverwrite: true,
  });

  return NextResponse.json(blob);
}
