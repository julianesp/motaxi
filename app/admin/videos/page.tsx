'use client';

import { useState, useEffect } from 'react';

interface Video {
  id: string;
  title: string;
  youtubeUrl: string;
  uploadedAt: number;
}

function getYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function AdminVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [error, setError] = useState('');

  async function fetchVideos() {
    setLoading(true);
    try {
      const res = await fetch('/api/videos');
      const data = await res.json();
      setVideos(data.sort((a: Video, b: Video) => a.uploadedAt - b.uploadedAt));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchVideos(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!getYoutubeId(youtubeUrl)) {
      setError('El enlace de YouTube no es válido.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), youtubeUrl }),
      });
      if (!res.ok) throw new Error();
      setTitle('');
      setYoutubeUrl('');
      await fetchVideos();
    } catch {
      setError('Error al guardar el video.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este video?')) return;
    await fetch('/api/videos', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await fetchVideos();
  }

  const previewId = getYoutubeId(youtubeUrl);

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Videos de instrucciones</h1>
        <p className="text-gray-400 text-sm mt-1">Agrega videos de YouTube que se mostrarán en la página principal</p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleAdd} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Agregar video</h2>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Título</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ej: Cómo pedir un viaje"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#008000]"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Enlace de YouTube</label>
          <input
            type="url"
            value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value)}
            placeholder="https://youtu.be/..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#008000]"
            required
          />
        </div>

        {/* Preview */}
        {previewId && (
          <div className="rounded-xl overflow-hidden aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${previewId}`}
              className="w-full h-full"
              allowFullScreen
              title="Vista previa"
            />
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-[#008000] hover:bg-[#38b018] disabled:opacity-50 text-black font-semibold px-6 py-2 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Guardando...' : 'Agregar video'}
        </button>
      </form>

      {/* Lista */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Videos publicados ({videos.length})
        </h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#008000]"></div>
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
            No hay videos publicados aún
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {videos.map((video) => {
              const ytId = getYoutubeId(video.youtubeUrl);
              return (
                <div key={video.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {ytId && (
                    <div className="aspect-video bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        className="w-full h-full"
                        allowFullScreen
                        title={video.title}
                      />
                    </div>
                  )}
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium text-sm">{video.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {new Date(video.uploadedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="text-red-400 hover:text-red-300 transition-colors ml-4"
                      title="Eliminar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
