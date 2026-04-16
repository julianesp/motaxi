import { useState, useEffect, useCallback, useRef } from 'react';
import { namedPlacesService, NamedPlace, CreateNamedPlaceData } from '../services/namedPlaces';

export function useNamedPlaces() {
  const [searchResults, setSearchResults] = useState<NamedPlace[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<NamedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSaved = useCallback(async () => {
    try {
      const data = await namedPlacesService.getSaved();
      setSavedPlaces(data);
    } catch (err: any) {
      console.error('Error loading saved places:', err);
      setSavedPlaces([]);
    }
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const results = await namedPlacesService.search(q);
        setSearchResults(results);
      } catch (err: any) {
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  const createPlace = async (data: CreateNamedPlaceData): Promise<NamedPlace> => {
    try {
      const place = await namedPlacesService.create(data);
      // El lugar recién creado aparece como guardado por defecto para quien lo creó
      setSavedPlaces((prev) => [{ ...place, is_saved: 1 }, ...prev]);
      return place;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const deletePlace = async (id: string) => {
    try {
      await namedPlacesService.delete(id);
      setSavedPlaces((prev) => prev.filter((p) => p.id !== id));
      setSearchResults((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const savePlace = async (placeId: string) => {
    try {
      await namedPlacesService.savePlace(placeId);
      setSearchResults((prev) =>
        prev.map((p) => (p.id === placeId ? { ...p, is_saved: 1 } : p))
      );
      await loadSaved();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const unsavePlace = async (placeId: string) => {
    try {
      await namedPlacesService.unsavePlace(placeId);
      setSavedPlaces((prev) => prev.filter((p) => p.id !== placeId));
      setSearchResults((prev) =>
        prev.map((p) => (p.id === placeId ? { ...p, is_saved: 0 } : p))
      );
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return {
    searchResults,
    savedPlaces,
    loading,
    error,
    search,
    clearSearch,
    createPlace,
    deletePlace,
    savePlace,
    unsavePlace,
    refreshSaved: loadSaved,
  };
}
