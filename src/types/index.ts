// Tipos principales de la aplicación

export type UserRole = 'passenger' | 'driver';

export interface User {
  id: string;
  email: string;
  phone: string;
  full_name: string;
  role: UserRole;
  profile_image?: string;
  created_at: string;
  updated_at: string;
}

export interface Driver extends User {
  license_number: string;
  vehicle_plate: string;
  vehicle_model: string;
  vehicle_color: string;
  is_available: boolean;
  rating: number;
  total_trips: number;
  photo_license?: string;
  photo_vehicle?: string;
  is_verified: boolean;
}

export interface Passenger extends User {
  rating: number;
  total_trips: number;
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  timestamp: number;
}

export type TripStatus = 'requested' | 'accepted' | 'driver_arriving' | 'in_progress' | 'completed' | 'cancelled';

export interface Trip {
  id: string;
  passenger_id: string;
  driver_id?: string;
  pickup_location: Location;
  dropoff_location: Location;
  status: TripStatus;
  fare: number;
  distance_km: number;
  duration_minutes?: number;
  requested_at: string;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  passenger_rating?: number;
  driver_rating?: number;
  route_polyline?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'trip_request' | 'trip_accepted' | 'trip_started' | 'trip_completed' | 'trip_cancelled' | 'general';
  is_read: boolean;
  data?: any;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  type: 'cash' | 'card' | 'digital_wallet';
  is_default: boolean;
  card_last_four?: string;
  created_at: string;
}

export interface Earning {
  id: string;
  driver_id: string;
  trip_id: string;
  amount: number;
  commission: number;
  net_amount: number;
  paid_at?: string;
  created_at: string;
}
