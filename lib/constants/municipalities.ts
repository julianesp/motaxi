// Municipios del Valle de Sibundoy
export interface Municipality {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  description: string;
  population?: number;
}

// Coordenadas aproximadas del Valle de Sibundoy (Putumayo, Colombia)
export const MUNICIPALITIES: Municipality[] = [
  {
    id: 'santiago',
    name: 'Santiago',
    coordinates: { lat: 1.1483, lng: -77.0811 },
    description: 'Municipio del Valle de Sibundoy',
    population: 8000,
  },
  {
    id: 'colon',
    name: 'Colón',
    coordinates: { lat: 1.1831, lng: -77.0342 },
    description: 'Municipio del Valle de Sibundoy',
    population: 7000,
  },
  {
    id: 'sibundoy',
    name: 'Sibundoy',
    coordinates: { lat: 1.1556, lng: -77.0625 },
    description: 'Capital del Valle de Sibundoy',
    population: 14000,
  },
  {
    id: 'san-francisco',
    name: 'San Francisco',
    coordinates: { lat: 1.1908, lng: -76.8817 },
    description: 'Municipio del Valle de Sibundoy',
    population: 6000,
  },
];

// Centro del Valle de Sibundoy
export const VALLE_SIBUNDOY_CENTER = {
  lat: 1.1656,
  lng: -77.0,
};

// Límites aproximados del Valle
export const VALLE_BOUNDS = {
  north: 1.25,
  south: 1.08,
  east: -76.85,
  west: -77.15,
};
