
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Appointment, AppointmentStatus, Barber, SystemSettings, LogEntry } from '../types';
import { DEFAULT_SETTINGS, MOCK_BARBERS } from '../constants';

const KEYS = {
  APPOINTMENTS: 'barber_app_appointments',
  SETTINGS: 'barber_app_settings',
  BARBERS: 'barber_app_barbers',
  DB_CONFIG: 'barber_app_db_config', // LocalStorage key for DB credentials
  LOGS: 'barber_app_logs'
};

// Helper to log available env keys for debugging (masked)
const debugEnv = () => {
  const visibleKeys: string[] = [];
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      Object.keys(import.meta.env).forEach(k => {
        if (k.includes('KEY') || k.includes('URL') || k.includes('DB')) visibleKeys.push(k);
      });
    }
    if (typeof process !== 'undefined' && process.env) {
      Object.keys(process.env).forEach(k => {
        if (k.includes('KEY') || k.includes('URL') || k.includes('DB')) visibleKeys.push(k);
      });
    }
  } catch (e) {}
  if (visibleKeys.length > 0) {
    console.log("[Env Debug] Detectable Env Keys:", visibleKeys);
  } else {
    console.log("[Env Debug] No specific Env Keys detected. Ensure variables start with 'VITE_' or 'REACT_APP_'.");
  }
};

// Robust environment variable access
const getEnvVar = (key: string): string => {
  // 1. Try explicit VITE_ prefix (Standard for Vite)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env[`VITE_${key}`]) return import.meta.env[`VITE_${key}`];
      // @ts-ignore
      if (import.meta.env[key]) return import.meta.env[key];
    }
  } catch (e) {}

  // 2. Try explicit REACT_APP_ prefix (Standard for CRA)
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env[`REACT_APP_${key}`]) return process.env[`REACT_APP_${key}`];
      if (process.env[`VITE_${key}`]) return process.env[`VITE_${key}`];
      if (process.env[key]) return process.env[key];
    }
  } catch (e) {}

  return '';
};

// Run debug on load
debugEnv();

const ENV_SUPABASE_URL = getEnvVar('SUPABASE_URL');
const ENV_SUPABASE_KEY = getEnvVar('SUPABASE_KEY');

let supabase: SupabaseClient | null = null;
let usingEnv = false;

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Initialize Supabase Client dynamically
const initSupabase = () => {
  try {
    // 1. Try Environment Variables FIRST
    if (ENV_SUPABASE_URL && ENV_SUPABASE_KEY && isValidUrl(ENV_SUPABASE_URL)) {
      console.log("Initializing Supabase from Environment Variables.");
      try {
        supabase = createClient(ENV_SUPABASE_URL, ENV_SUPABASE_KEY);
        usingEnv = true;
        return; // Stop here, Env takes precedence
      } catch (e) {
        console.error("Failed to create Supabase client from Env", e);
      }
    } else {
        if (!ENV_SUPABASE_URL) console.log("No Supabase URL found in Env.");
    }

    // 2. Fallback to LocalStorage
    usingEnv = false;
    const storedConfig = localStorage.getItem(KEYS.DB_CONFIG);
    if (storedConfig) {
      try {
        const { url, key } = JSON.parse(storedConfig);
        if (url && key && isValidUrl(url)) {
          supabase = createClient(url, key);
        }
      } catch (parseError) {
        console.warn("Invalid stored DB config", parseError);
      }
    }
  } catch (e) {
    console.error("Failed to initialize Supabase client", e);
    supabase = null;
    usingEnv = false;
  }
};

// Initial run
initSupabase();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to determine if we should use DB
const useDB = () => !!supabase;

export const StorageService = {
  // Configuration Methods
  isUsingEnv: () => usingEnv,

  updateConnection: (url: string, key: string) => {
    if (usingEnv) {
      console.warn("Cannot update connection when using Environment Variables.");
      return; 
    }

    if (!url || !key) {
      localStorage.removeItem(KEYS.DB_CONFIG);
      supabase = null;
      // Try re-initializing (though logic says Env first, if we are here, Env failed or wasn't present)
      initSupabase();
    } else {
      if (!isValidUrl(url)) {
        throw new Error("提供的 URL 格式无效");
      }
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
    if (usingEnv) {
      return { url: ENV_SUPABASE_URL, key: '****** (Environment Variable Configured)' };
    }
    const stored = localStorage.getItem(KEYS.DB_CONFIG);
    if (stored) return JSON.parse(stored);
    return { url: '', key: '' };
  },

  // --- LOGGING SYSTEM ---
  getLogs: async (): Promise<LogEntry[]> => {
    if (useDB() && supabase) {
      try {
        const { data } = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(100);
        return (data || []) as LogEntry[];
      } catch (error) {
        console.error("Fetch logs error", error);
        return [];
      }
    }

    await delay(200);
    const stored = localStorage.getItem(KEYS.LOGS);
    return stored ? JSON.parse(stored) : [];
  },

  addLog: async (action: string, details: string): Promise<void> => {
    const newLog: LogEntry = {
      id: crypto.randomUUID(),
      action,
      details,
      timestamp: Date.now()
    };

    if (useDB() && supabase) {
      // Async insert, don't await to block UI
      supabase.from('logs').insert(newLog).then(({ error }) => {
        if (error) console.error("Log insert failed", error);
      });
      return;
    }

    // Local Storage
    const stored = localStorage.getItem(KEYS.LOGS);
    const logs: LogEntry[] = stored ? JSON.parse(stored) : [];
    logs.unshift(newLog); // Add to beginning
    // Keep only last 200 logs locally
    if (logs.length > 200) logs.length = 200;
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  },

  // --- DATA METHODS ---

  getSettings: async (): Promise<SystemSettings> => {
    if (useDB() && supabase) {
      try {
        const { data, error } = await supabase.from('settings').select('*').limit(1).single();
        if (data) return data as SystemSettings;
        if (error) {
           console.warn("Supabase settings fetch error:", error.message);
        }
      } catch (error) {
        console.error("Supabase error:", error);
      }
      return DEFAULT_SETTINGS;
    }
    
    await delay(300);
    const stored = localStorage.getItem(KEYS.SETTINGS);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  },

  saveSettings: async (settings: SystemSettings): Promise<void> => {
    // Log the change
    await StorageService.addLog('系统配置', `更新了营业时间或最大预约数`);

    if (useDB() && supabase) {
      await supabase.from('settings').upsert({ id: 1, ...settings });
      return;
    }

    await delay(300);
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },

  getBarbers: async (): Promise<Barber[]> => {
    if (useDB() && supabase) {
      try {
        const { data, error } = await supabase.from('barbers').select('*');
        if (data && data.length > 0) return data as Barber[];
        
        if (data && data.length === 0) {
           const { error: insertError } = await supabase.from('barbers').insert(MOCK_BARBERS);
           if (!insertError) return MOCK_BARBERS;
        }
      } catch (error) {
        console.error("Supabase error:", error);
      }
      return MOCK_BARBERS;
    }

    await delay(300);
    const stored = localStorage.getItem(KEYS.BARBERS);
    return stored ? JSON.parse(stored) : MOCK_BARBERS;
  },

  saveBarbers: async (barbers: Barber[]): Promise<void> => {
    // Determine if add or update roughly
    await StorageService.addLog('理发师管理', `更新了理发师列表 (总数: ${barbers.length})`);

    if (useDB() && supabase) {
      await supabase.from('barbers').upsert(barbers);
      return;
    }

    await delay(300);
    localStorage.setItem(KEYS.BARBERS, JSON.stringify(barbers));
  },

  deleteBarber: async (id: string): Promise<void> => {
    await StorageService.addLog('理发师管理', `删除了理发师 ID: ${id}`);

    if (useDB() && supabase) {
      await supabase.from('barbers').delete().eq('id', id);
      return;
    }

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

    await delay(300);
    const stored = localStorage.getItem(KEYS.APPOINTMENTS);
    return stored ? JSON.parse(stored) : [];
  },

  addAppointment: async (app: Appointment): Promise<void> => {
    await StorageService.addLog('预约创建', `客户 ${app.customerName} 预约了 ${app.date} ${app.timeSlot}`);

    if (useDB() && supabase) {
      await supabase.from('appointments').insert(app);
      return;
    }

    await delay(500);
    const stored = localStorage.getItem(KEYS.APPOINTMENTS);
    const apps = stored ? JSON.parse(stored) : [];
    apps.push(app);
    localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(apps));
  },

  updateAppointmentStatus: async (id: string, status: AppointmentStatus): Promise<boolean> => {
    let action = '状态更新';
    if (status === AppointmentStatus.COMPLETED) action = '签到完成';
    if (status === AppointmentStatus.CANCELLED) action = '预约取消';
    
    await StorageService.addLog(action, `预约 ID ${id} 状态变更为 ${status}`);

    if (useDB() && supabase) {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);
      return !error;
    }

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
