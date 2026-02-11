import { apiClient } from '../api-client';

export interface FavoriteLocation {
  id: string;
  user_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  place_id?: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateFavoriteData {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  place_id?: string;
}

export interface UpdateFavoriteData {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  place_id?: string;
}

class FavoritesService {
  async getFavorites(): Promise<FavoriteLocation[]> {
    try {
      const response = await apiClient.get('/favorites');
      return response.data?.favorites || [];
    } catch (error: any) {
      console.error('Error fetching favorites:', error);
      throw new Error(error.response?.data?.error || error.message || 'Error al obtener favoritos');
    }
  }

  async createFavorite(data: CreateFavoriteData): Promise<FavoriteLocation> {
    try {
      const response = await apiClient.post('/favorites', data);
      return response.data?.favorite;
    } catch (error: any) {
      console.error('Error creating favorite:', error);
      throw new Error(error.response?.data?.error || error.message || 'Error al crear favorito');
    }
  }

  async updateFavorite(id: string, data: UpdateFavoriteData): Promise<FavoriteLocation> {
    try {
      const response = await apiClient.put(`/favorites/${id}`, data);
      return response.data?.favorite;
    } catch (error: any) {
      console.error('Error updating favorite:', error);
      throw new Error(error.response?.data?.error || error.message || 'Error al actualizar favorito');
    }
  }

  async deleteFavorite(id: string): Promise<void> {
    try {
      await apiClient.delete(`/favorites/${id}`);
    } catch (error: any) {
      console.error('Error deleting favorite:', error);
      throw new Error(error.response?.data?.error || error.message || 'Error al eliminar favorito');
    }
  }
}

export const favoritesService = new FavoritesService();

