import { apiClient } from '../api-client';

export interface NamedPlace {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  created_by: string;
  creator_name?: string;
  is_saved?: number; // 0 | 1
  created_at: number;
}

export interface CreateNamedPlaceData {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  description?: string;
}

export interface UpdateNamedPlaceData {
  name?: string;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

class NamedPlacesService {
  async search(q: string): Promise<NamedPlace[]> {
    try {
      const response = await apiClient.get(`/named-places?q=${encodeURIComponent(q)}`);
      return response.data?.places || [];
    } catch (error: any) {
      console.error('Error searching named places:', error);
      return [];
    }
  }

  async getSaved(): Promise<NamedPlace[]> {
    try {
      const response = await apiClient.get('/named-places/saved');
      return response.data?.places || [];
    } catch (error: any) {
      console.error('Error fetching saved places:', error);
      return [];
    }
  }

  async create(data: CreateNamedPlaceData): Promise<NamedPlace> {
    try {
      const response = await apiClient.post('/named-places', data);
      return response.data?.place;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Error al crear el lugar');
    }
  }

  async update(id: string, data: UpdateNamedPlaceData): Promise<NamedPlace> {
    try {
      const response = await apiClient.put(`/named-places/${id}`, data);
      return response.data?.place;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Error al actualizar el lugar');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await apiClient.delete(`/named-places/${id}`);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Error al eliminar el lugar');
    }
  }

  async savePlace(placeId: string): Promise<void> {
    try {
      await apiClient.post(`/named-places/${placeId}/save`, {});
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Error al guardar el lugar');
    }
  }

  async unsavePlace(placeId: string): Promise<void> {
    try {
      await apiClient.delete(`/named-places/${placeId}/save`);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Error al quitar el lugar guardado');
    }
  }
}

export const namedPlacesService = new NamedPlacesService();
