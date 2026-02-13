import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Appointment, AppointmentStatus, Barber, SystemSettings } from '../types';
import { DEFAULT_SETTINGS, MOCK_BARBERS } from '../constants';

const KEYS = {
  APPOINTMENTS: 'barber_app_appointments',
  SETTINGS: 'barber_app_settings',
  BARBERS: 'barber_app_barbers',
  DB_CONFIG: 'barber_app_db_config' // LocalStorage key for DB credentials
};

// Default from Env (if available)
const ENV_SUPABASE_URL = process.env.SUPABASE_URL || '';
const ENV_SUPABASE_KEY = process.env.SUPABASE_KEY || '';

let supabase: SupabaseClient | null = null;

// Initialize Supabase Client dynamically
const initSupabase = () => {
  try {
    // 1. Try LocalStorage first
    const storedConfig = localStorage.getItem(KEYS.DB_CONFIG);
    if (storedConfig) {
      const { url, key } = JSON.parse(storedConfig);
      if (url && key) {
        supabase = createClient(url, key);
        return;
      }
    }

    // 2. Fallback to Env
    if (ENV_SUPABASE_URL && ENV_SUPABASE_KEY) {
      supabase = createClient(ENV_SUPABASE_URL, ENV_SUPABASE_KEY);
    }
  } catch (e) {
    console.error("Failed to initialize Supabase client", e);
    supabase = null;
  }
};

// Initial run
initSupabase();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to determine if we should use DB
const useDB = () => !!supabase;

export const StorageService = {
  // Configuration Methods
  updateConnection: (url: string, key: string) => {
    if (!url || !key) {
      localStorage.removeItem(KEYS.DB_CONFIG);
      supabase = null;
    } else {
      localStorage.setItem(KEYS.DB_CONFIG, JSON.stringify({ url, key }));
      try {
        supabase = createClient(url, key);
      } catch (e) {
        console.error("Invalid Supabase Config", e);
        throw e;
      }
    }
  },

  getConnectionConfig: () => {
    const stored = localStorage.getItem(KEYS.DB_CONFIG);
    if (stored) return JSON.parse(stored);
    return { url: ENV_SUPABASE_URL, key: ENV_SUPABASE_KEY };
  },

  // Data Methods
  getSettings: async (): Promise<SystemSettings> => {
    if (useDB() && supabase) {
      try {
        const { data, error } = await supabase.from('settings').select('*').limit(1).single();
        if (data) return data as SystemSettings;
        if (error) {
           console.warn("Supabase settings fetch error:", error.message);
           // Fallback to defaults if table is empty or error, but continue using DB flow next time
        }
      } catch (error) {
        console.error("Supabase error:", error);
      }
      return DEFAULT_SETTINGS;
    }
    
    // Mock Implementation
    await delay(300);
    const stored = localStorage.getItem(KEYS.SETTINGS);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  },

  saveSettings: async (settings: SystemSettings): Promise<void> => {
    if (useDB() && supabase) {
      // Upsert assuming row ID=1
      await supabase.from('settings').upsert({ id: 1, ...settings });
      return;
    }

    // Mock Implementation
    await delay(300);
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },

  getBarbers: async (): Promise<Barber[]> => {
    if (useDB() && supabase) {
      try {
        const { data, error } = await supabase.from('barbers').select('*');
        if (data && data.length > 0) return data as Barber[];
        
        // If DB is empty, seed it with mock barbers for better UX
        if (data && data.length === 0) {
           // Attempt to seed if RLS allows
           const { error: insertError } = await supabase.from('barbers').insert(MOCK_BARBERS);
           if (!insertError) return MOCK_BARBERS;
        }
      } catch (error) {
        console.error("Supabase error:", error);
      }
      return MOCK_BARBERS;
    }

    // Mock Implementation
    await delay(300);
    const stored = localStorage.getItem(KEYS.BARBERS);
    return stored ? JSON.parse(stored) : MOCK_BARBERS;
  },

  saveBarbers: async (barbers: Barber[]): Promise<void> => {
    if (useDB() && supabase) {
      await supabase.from('barbers').upsert(barbers);
      return;
    }

    // Mock Implementation
    await delay(300);
    localStorage.setItem(KEYS.BARBERS, JSON.stringify(barbers));
  },

  deleteBarber: async (id: string): Promise<void> => {
    if (useDB() && supabase) {
      await supabase.from('barbers').delete().eq('id', id);
      return;
    }

    // Mock Implementation
    await delay(300);
    const stored = localStorage.getItem(KEYS.BARBERS);
    if (stored) {
      const list = JSON.parse(stored) as Barber[];
      const newList = list.filter(b => b.id !== id);
      localStorage.setItem(KEYS.BARBERS, JSON.stringify(newList));
    }
  },

  getAppointments: async (): Promise<Appointment[]> => {
    if (useDB() && supabase) {
      try {
        const { data } = await supabase.from('appointments').select('*');
        return (data || []) as Appointment[];
      } catch (error) {
        console.error(error);
        return [];
      }
    }

    // Mock Implementation
    await delay(300);
    const stored = localStorage.getItem(KEYS.APPOINTMENTS);
    return stored ? JSON.parse(stored) : [];
  },

  addAppointment: async (app: Appointment): Promise<void> => {
    if (useDB() && supabase) {
      await supabase.from('appointments').insert(app);
      return;
    }

    // Mock Implementation
    await delay(500);
    const stored = localStorage.getItem(KEYS.APPOINTMENTS);
    const apps = stored ? JSON.parse(stored) : [];
    apps.push(app);
    localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(apps));
  },

  updateAppointmentStatus: async (id: string, status: AppointmentStatus): Promise<boolean> => {
    if (useDB() && supabase) {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);
      return !error;
    }

    // Mock Implementation
    await delay(300);
    const stored = localStorage.getItem(KEYS.APPOINTMENTS);
    const apps: Appointment[] = stored ? JSON.parse(stored) : [];
    const index = apps.findIndex(a => a.id === id);
    if (index !== -1) {
      apps[index].status = status;
      localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(apps));
      return true;
    }
    return false;
  }
};