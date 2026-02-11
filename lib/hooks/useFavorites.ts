import { useState, useEffect, useCallback } from 'react';
import { favoritesService, FavoriteLocation, CreateFavoriteData, UpdateFavoriteData } from '../services/favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await favoritesService.getFavorites();
      setFavorites(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading favorites:', err);
      // No bloquear la app si falla cargar favoritos
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const addFavorite = async (data: CreateFavoriteData) => {
    try {
      const newFavorite = await favoritesService.createFavorite(data);
      setFavorites((prev) => [newFavorite, ...prev]);
      return newFavorite;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateFavorite = async (id: string, data: UpdateFavoriteData) => {
    try {
      const updatedFavorite = await favoritesService.updateFavorite(id, data);
      setFavorites((prev) => prev.map((fav) => (fav.id === id ? updatedFavorite : fav)));
      return updatedFavorite;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const deleteFavorite = async (id: string) => {
    try {
      await favoritesService.deleteFavorite(id);
      setFavorites((prev) => prev.filter((fav) => fav.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const refresh = () => {
    loadFavorites();
  };

  return {
    favorites,
    loading,
    error,
    addFavorite,
    updateFavorite,
    deleteFavorite,
    refresh,
  };
}
