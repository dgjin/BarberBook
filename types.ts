export enum AppointmentStatus {
  BOOKED = 'BOOKED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface Barber {
  id: string;
  name: string;
  specialty: string;
  avatarUrl: string;
  bio: string;
}

export interface Appointment {
  id: string;
  barberId: string;
  userId: string; // Ideally from auth, we'll use a local mock ID
  userName: string; // System username (or fallback)
  customerName: string; // User entered name
  customerPhone: string; // User entered phone
  date: string; // ISO Date string YYYY-MM-DD
  timeSlot: string; // HH:mm
  status: AppointmentStatus;
  timestamp: number;
}

export interface SystemSettings {
  maxSlotsPerBarberPerDay: number;
  openingTime: string; // "09:00"
  closingTime: string; // "18:00"
  slotDurationMinutes: number; // e.g., 30 or 60
}

export type ViewState = 'HOME' | 'BOOKING' | 'MY_APPOINTMENTS' | 'ADMIN' | 'AI_ADVISOR' | 'SCANNER';