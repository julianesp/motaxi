'use client';

import { useState, useEffect, useRef } from 'react';

interface Video {
  title: string;
  url: string;
  uploadedAt: number;
}

export default function AdminVideos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [progress, setProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function fetchVideos() {
    setLoading(true);
    try {
      const res = await fetch('/api/videos');
      const data = await res.json();
      setVideos(data.sort((a: Video, b: Video) => b.uploadedAt - a.uploadedAt));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchVideos(); }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) return;

    setUploading(true);
    setProgress('Subiendo video...');
    try {
      const params = new URLSearchParams({ filename: file.name, title: title.trim() });
      const res = await fetch(`/api/videos/upload?${params}`, {
        method: 'POST',
        body: file,
        headers: { 'content-type': file.type },
      });
      if (!res.ok) throw new Error('Error al subir');
      setTitle('');
      if (fileRef.current) fileRef.current.value = '';
      setProgress('Video subido correctamente.');
      await fetchVideos();
    } catch {
      setProgress('Error al subir el video.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(url: string) {
    if (!confirm('¿Eliminar este video?')) return;
    await fetch('/api/videos', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    await fetchVideos();
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Videos de instrucciones</h1>
        <p className="text-gray-400 text-sm mt-1">Sube videos que se mostrarán en la página principal</p>
      </div>

      {/* Formulario subida */}
      <form onSubmit={handleUpload} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Subir nuevo video</h2>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Título</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ej: Cómo pedir un viaje"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#42CE1D]"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Archivo de video</label>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            required
            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#42CE1D] file:text-black file:font-semibold hover:file:bg-[#38b018] cursor-pointer"
          />
        </div>
        {progress && (
          <p className={`text-sm ${progress.includes('Error') ? 'text-red-400' : 'text-[#42CE1D]'}`}>{progress}</p>
        )}
        <button
          type="submit"
          disabled={uploading}
          className="bg-[#42CE1D] hover:bg-[#38b018] disabled:opacity-50 text-black font-semibold px-6 py-2 rounded-lg text-sm transition-colors"
        >
          {uploading ? 'Subiendo...' : 'Subir video'}
        </button>
      </form>

      {/* Lista de videos */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Videos publicados ({videos.length})
        </h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#42CE1D]"></div>
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
            No hay videos publicados aún
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {videos.map((video) => (
              <div key={video.url} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <video
                  src={video.url}
                  controls
                  className="w-full aspect-video bg-black"
                />
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium text-sm">{video.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {new Date(video.uploadedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(video.url)}
                    className="text-red-400 hover:text-red-300 transition-colors ml-4"
                    title="Eliminar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
