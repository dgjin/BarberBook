
export enum AppointmentStatus {
  BOOKED = 'BOOKED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  username: string;
  password?: string; // Only used for storage/verification
  name: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  wechatId?: string; // WeChat OpenID link
  createdAt: number;
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
  userId: string; 
  userName: string; // System username
  customerName: string; // Display name
  customerPhone: string;
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

export interface LogEntry {
  id: string;
  action: string; // e.g., '预约创建', '取消预约', '系统配置'
  details: string;
  timestamp: number;
}

export type ViewState = 'HOME' | 'BOOKING' | 'MY_APPOINTMENTS' | 'ADMIN' | 'AI_ADVISOR' | 'SCANNER' | 'LOGIN' | 'PROFILE';
