
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Appointment, AppointmentStatus, Barber, SystemSettings, LogEntry, User } from '../types';
import { DEFAULT_SETTINGS, MOCK_BARBERS } from '../constants';

const KEYS = {
  APPOINTMENTS: 'barber_app_appointments',
  SETTINGS: 'barber_app_settings',
  BARBERS: 'barber_app_barbers',
  DB_CONFIG: 'barber_app_db_config', // LocalStorage key for DB credentials
  LOGS: 'barber_app_logs',
  USERS: 'barber_app_users',
  SESSION: 'barber_app_current_user'
};

// Default Configuration provided by user
const DEFAULT_DB_URL = 'https://ggqyitnxjcbulitacogg.supabase.co';
const DEFAULT_DB_KEY = 'sb_publishable_HeSdC3qng_IfFMZjdiQHkA_DEqRdivF';

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

    // 2. Fallback to LocalStorage or Defaults
    usingEnv = false;
    let targetUrl = DEFAULT_DB_URL;
    let targetKey = DEFAULT_DB_KEY;

    const storedConfig = localStorage.getItem(KEYS.DB_CONFIG);
    if (storedConfig) {
      try {
        const { url, key } = JSON.parse(storedConfig);
        // Only override defaults if user has set specific valid values
        if (url && key && isValidUrl(url)) {
          targetUrl = url;
          targetKey = key;
        }
      } catch (parseError) {
        console.warn("Invalid stored DB config", parseError);
      }
    }
    
    // Attempt to initialize with determined credentials
    if (targetUrl && targetKey && isValidUrl(targetUrl)) {
         try {
             supabase = createClient(targetUrl, targetKey);
         } catch(e) { console.error("Error creating supabase client", e); }
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

// Initialize Default Admin (Local Storage Mode)
const initDefaultAdmin = () => {
  const storedUsers = localStorage.getItem(KEYS.USERS);
  if (!storedUsers) {
    const adminUser: User = {
      id: 'admin_001',
      username: 'admin',
      password: 'admin123',
      name: '系统管理员',
      phone: '13800000000',
      role: 'ADMIN',
      createdAt: Date.now()
    };
    localStorage.setItem(KEYS.USERS, JSON.stringify([adminUser]));
    console.log("Default admin initialized (Local).");
  }
};

// Run init
initDefaultAdmin();

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
      // Clear specific config, this will cause initSupabase to fall back to defaults
      localStorage.removeItem(KEYS.DB_CONFIG);
      supabase = null;
      // Try re-initializing (will pick up defaults)
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
    
    // Return defaults
    return { url: DEFAULT_DB_URL, key: DEFAULT_DB_KEY };
  },

  // --- AUTHENTICATION METHODS ---

  getCurrentUser: (): User | null => {
    const stored = localStorage.getItem(KEYS.SESSION);
    return stored ? JSON.parse(stored) : null;
  },

  login: async (username: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
    await delay(500); // Simulate network

    let user: User | undefined;

    // 1. Try DB first if available
    if (useDB() && supabase) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password) // Note: In production, verify hash!
                .maybeSingle();
            
            if (data) {
                user = data as User;
            }
        } catch (e) {
            console.error("DB Login Error", e);
        }
    }
    
    // 2. Fallback to Local Storage if not found in DB
    if (!user) {
        const storedUsersStr = localStorage.getItem(KEYS.USERS);
        const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];
        user = users.find(u => u.username === username && u.password === password);
    }
    
    if (user) {
      // Remove password from session object
      const { password, ...safeUser } = user;
      localStorage.setItem(KEYS.SESSION, JSON.stringify(safeUser));
      return { success: true, user: safeUser as User };
    }
    
    return { success: false, message: '用户名或密码错误' };
  },

  loginWithWeChatCode: async (code: string): Promise<{ success: boolean; user?: User; message?: string }> => {
     console.log("Processing WeChat Auth Code:", code);
     await delay(1500); 

     const mockOpenId = `wx_user_${code.substring(0, 8)}`; 
     let user: User | undefined;

     // 1. Try DB
     if (useDB() && supabase) {
         try {
             const { data } = await supabase.from('users').select('*').eq('wechatId', mockOpenId).maybeSingle();
             if (data) user = data as User;
         } catch(e) { console.error(e); }
     }

     // 2. Local Storage
     if (!user) {
        const storedUsersStr = localStorage.getItem(KEYS.USERS);
        const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];
        user = users.find(u => u.wechatId === mockOpenId);
     }

     // 3. Register
     if (!user) {
         const randomSuffix = Math.floor(Math.random() * 10000);
         const newUser: User = {
             id: crypto.randomUUID(),
             username: `wx_${randomSuffix}`,
             name: `微信用户${randomSuffix}`,
             phone: '',
             role: 'USER',
             wechatId: mockOpenId,
             avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=wx_${randomSuffix}`,
             createdAt: Date.now()
         };

         if (useDB() && supabase) await supabase.from('users').insert(newUser);
         
         const storedUsersStr = localStorage.getItem(KEYS.USERS);
         const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];
         users.push(newUser);
         localStorage.setItem(KEYS.USERS, JSON.stringify(users));

         user = newUser;
     }

     if (user) {
         const { password, ...safeUser } = user;
         localStorage.setItem(KEYS.SESSION, JSON.stringify(safeUser));
         return { success: true, user: safeUser };
     }

     return { success: false, message: '微信授权失败' };
  },

  logout: () => {
    localStorage.removeItem(KEYS.SESSION);
  },

  register: async (newUser: Omit<User, 'id' | 'createdAt'>): Promise<{ success: boolean; message?: string }> => {
    await delay(500);

    const userToSave = {
      ...newUser,
      id: crypto.randomUUID(),
      createdAt: Date.now()
    };

    if (useDB() && supabase) {
        try {
             const { data: existing } = await supabase.from('users').select('id').eq('username', newUser.username).maybeSingle();
             if (existing) return { success: false, message: '用户名已存在' };
             const { error } = await supabase.from('users').insert(userToSave);
             if (error) return { success: false, message: '注册失败，请稍后重试' };
        } catch (e) {
             return { success: false, message: '系统连接错误' };
        }
    } else {
        const storedUsersStr = localStorage.getItem(KEYS.USERS);
        const users: User[] = storedUsersStr ? JSON.parse(storedUsersStr) : [];
        if (users.some(u => u.username === newUser.username)) {
          return { success: false, message: '用户名已存在' };
        }
        users.push(userToSave as User);
        localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    }
    
    const { password, ...safeUser } = userToSave;
    localStorage.setItem(KEYS.SESSION, JSON.stringify(safeUser));
    return { success: true };
  },

  updateUser: async (updatedUser: User): Promise<{ success: boolean; message?: string }> => {
    await delay(300);
    
    try {
        // 1. Update in DB
        if (useDB() && supabase) {
            const { error } = await supabase
                .from('users')
                .update({ 
                    name: updatedUser.name, 
                    phone: updatedUser.phone,
                    "avatarUrl": updatedUser.avatarUrl
                })
                .eq('id', updatedUser.id);
            
            if (error) throw error;
        }

        // 2. Update in LocalStorage (Database Replica/Fallback)
        const storedUsersStr = localStorage.getItem(KEYS.USERS);
        if (storedUsersStr) {
            const users: User[] = JSON.parse(storedUsersStr);
            const index = users.findIndex(u => u.id === updatedUser.id);
            if (index !== -1) {
                // Keep password if it exists locally
                const existingPass = users[index].password;
                users[index] = { ...updatedUser, password: existingPass };
                localStorage.setItem(KEYS.USERS, JSON.stringify(users));
            }
        }

        // 3. Update Current Session
        const { password, ...safeUser } = updatedUser;
        localStorage.setItem(KEYS.SESSION, JSON.stringify(safeUser));

        return { success: true };
    } catch (e) {
        console.error("Update user failed", e);
        return { success: false, message: '更新失败，请重试' };
    }
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
      supabase.from('logs').insert(newLog).then(({ error }) => {
        if (error) console.error("Log insert failed", error);
      });
      return;
    }

    const stored = localStorage.getItem(KEYS.LOGS);
    const logs: LogEntry[] = stored ? JSON.parse(stored) : [];
    logs.unshift(newLog);
    if (logs.length > 200) logs.length = 200;
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  },

  // --- DATA METHODS ---
  getSettings: async (): Promise<SystemSettings> => {
    if (useDB() && supabase) {
      try {
        const { data } = await supabase.from('settings').select('*').limit(1).single();
        if (data) return data as SystemSettings;
      } catch (error) {}
      return DEFAULT_SETTINGS;
    }
    
    await delay(300);
    const stored = localStorage.getItem(KEYS.SETTINGS);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  },

  saveSettings: async (settings: SystemSettings): Promise<void> => {
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
        const { data } = await supabase.from('barbers').select('*');
        if (data && data.length > 0) return data as Barber[];
        if (data && data.length === 0) {
           const { error: insertError } = await supabase.from('barbers').insert(MOCK_BARBERS);
           if (!insertError) return MOCK_BARBERS;
        }
      } catch (error) {}
      return MOCK_BARBERS;
    }

    await delay(300);
    const stored = localStorage.getItem(KEYS.BARBERS);
    return stored ? JSON.parse(stored) : MOCK_BARBERS;
  },

  saveBarbers: async (barbers: Barber[]): Promise<void> => {
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
        const { data } = await supabase.from('appointments').select('*').order('date', { ascending: true });
        return (data || []) as Appointment[];
      } catch (error) {
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
    if (status === AppointmentStatus.EXPIRED) action = '预约过期';
    
    await StorageService.addLog(action, `预约 ID ${id} 状态变更为 ${status}`);

    if (useDB() && supabase) {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
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
