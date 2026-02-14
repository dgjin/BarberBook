
import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { StorageService } from '../services/storageService';
import { SystemSettings, Appointment, AppointmentStatus, Barber, LogEntry } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { Save, Settings as SettingsIcon, Trash2, Loader2, RefreshCw, Database, Link, Users, Plus, Edit2, QrCode, Upload, Activity, Lock } from 'lucide-react';
import { format } from 'date-fns';

interface AdminPanelProps {}

export const AdminPanel: React.FC<AdminPanelProps> = () => {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'LOGS'>('SETTINGS');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dbConfig, setDbConfig] = useState({ url: '', key: '' });
  const [dbStatus, setDbStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isEnvConfigured, setIsEnvConfigured] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingBarberQr, setViewingBarberQr] = useState<{barber: Barber, url: string} | null>(null);

  useEffect(() => {
    loadData();
    const usingEnv = StorageService.isUsingEnv();
    setIsEnvConfigured(usingEnv);
    const config = StorageService.getConnectionConfig();
    setDbConfig({ url: config.url || '', key: config.key || '' });
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [s, a, b, l] = await Promise.all([
      StorageService.getSettings(),
      StorageService.getAppointments(),
      StorageService.getBarbers(),
      StorageService.getLogs()
    ]);
    setSettings(s);
    setAppointments(a);
    setBarbers(b);
    setLogs(l);
    setLoading(false);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    await StorageService.saveSettings(settings);
    const newLogs = await StorageService.getLogs();
    setLogs(newLogs);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveDbConfig = async () => {
    if (isEnvConfigured) return;
    try {
      StorageService.updateConnection(dbConfig.url, dbConfig.key);
      setDbStatus('success');
      await loadData();
      setTimeout(() => setDbStatus('idle'), 3000);
    } catch (e) {
      setDbStatus('error');
    }
  };

  const cancelAppointment = async (id: string) => {
    if (confirm('确定取消?')) {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: AppointmentStatus.CANCELLED } : a));
      await StorageService.updateAppointmentStatus(id, AppointmentStatus.CANCELLED);
      await loadData();
    }
  };

  const handleSaveBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBarber) return;
    setIsSaving(true);
    let newBarbers = [...barbers];
    const index = newBarbers.findIndex(b => b.id === editingBarber.id);
    if (index >= 0) newBarbers[index] = editingBarber; else newBarbers.push(editingBarber);
    await StorageService.saveBarbers(newBarbers);
    setBarbers(newBarbers);
    setEditingBarber(null);
    setIsSaving(false);
    setLogs(await StorageService.getLogs());
  };

  const handleDeleteBarber = async (id: string) => {
    if (!confirm("确定删除?")) return;
    await StorageService.deleteBarber(id);
    setBarbers(prev => prev.filter(b => b.id !== id));
    setLogs(await StorageService.getLogs());
  };

  const startEditBarber = (barber?: Barber) => {
    if (barber) setEditingBarber({ ...barber });
    else setEditingBarber({ id: crypto.randomUUID(), name: '', specialty: '', bio: '', avatarUrl: `https://picsum.photos/100/100?random=${Math.floor(Math.random() * 1000)}` });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxSize = 300; 
        let width = img.width, height = img.height;
        if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
        else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
        canvas.width = width; canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        setEditingBarber(prev => prev ? ({...prev, avatarUrl: canvas.toDataURL('image/jpeg', 0.8)}) : null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const showBarberQr = async (barber: Barber) => {
      try {
          const url = await QRCode.toDataURL(`BARBER_BOOK:${barber.id}`, { width: 400 });
          setViewingBarberQr({ barber, url });
      } catch (e) {}
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6 pb-20">
      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('SETTINGS')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeTab === 'SETTINGS' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>业务管理</button>
          <button onClick={() => setActiveTab('LOGS')} className={`flex-1 py-2 text-sm font-bold rounded-lg ${activeTab === 'LOGS' ? 'bg-white shadow text-brand-600' : 'text-gray-500'}`}>系统日志</button>
      </div>

      {viewingBarberQr && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6" onClick={() => setViewingBarberQr(null)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
                  <h3 className="text-xl font-bold mb-2">{viewingBarberQr.barber.name}</h3>
                  <img src={viewingBarberQr.url} alt="QR" className="w-full aspect-square border border-gray-100 rounded-lg my-4" />
                  <button onClick={() => setViewingBarberQr(null)} className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold">关闭</button>
              </div>
          </div>
      )}

      {activeTab === 'SETTINGS' && (
        <>
          <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
             <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><SettingsIcon size={18} /> 基础设置</h3>
             <div className="grid grid-cols-1 gap-4">
                <div><label className="text-xs font-bold text-gray-500">每日最大接客</label><input type="number" value={settings.maxSlotsPerBarberPerDay} onChange={(e) => setSettings({...settings, maxSlotsPerBarberPerDay: parseInt(e.target.value)})} className="w-full p-2 border rounded mt-1"/></div>
                <div>
                   <label className="text-xs font-bold text-gray-500">服务时长 (分)</label>
                   <select value={settings.slotDurationMinutes} onChange={(e) => setSettings({...settings, slotDurationMinutes: parseInt(e.target.value)})} className="w-full p-2 border rounded mt-1">
                      <option value={30}>30</option><option value={45}>45</option><option value={60}>60</option>
                   </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold text-gray-500">开门</label><input type="time" value={settings.openingTime} onChange={e => setSettings({...settings, openingTime: e.target.value})} className="w-full p-2 border rounded mt-1"/></div>
                    <div><label className="text-xs font-bold text-gray-500">关门</label><input type="time" value={settings.closingTime} onChange={e => setSettings({...settings, closingTime: e.target.value})} className="w-full p-2 border rounded mt-1"/></div>
                </div>
                <button onClick={handleSaveSettings} disabled={isSaving} className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold flex justify-center items-center gap-2">{isSaving && <Loader2 className="animate-spin" size={16}/>} 保存配置</button>
             </div>
          </section>

          <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-gray-800 flex items-center gap-2"><Users size={18}/> 理发师管理</h3>
               <button onClick={() => startEditBarber()} className="text-xs bg-brand-50 text-brand-600 px-3 py-1.5 rounded-full font-bold flex items-center gap-1"><Plus size={14}/> 添加</button>
            </div>
            
            {editingBarber ? (
               <form onSubmit={handleSaveBarber} className="bg-gray-50 p-4 rounded-xl space-y-3">
                   <input required placeholder="姓名" value={editingBarber.name} onChange={e => setEditingBarber({...editingBarber, name: e.target.value})} className="w-full p-2 border rounded" />
                   <input required placeholder="专长" value={editingBarber.specialty} onChange={e => setEditingBarber({...editingBarber, specialty: e.target.value})} className="w-full p-2 border rounded" />
                   <div className="flex items-center gap-3">
                      <img src={editingBarber.avatarUrl} className="w-12 h-12 rounded-full bg-gray-200" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs bg-white border px-3 py-1.5 rounded">上传头像</button>
                      <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                   </div>
                   <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => setEditingBarber(null)} className="flex-1 py-2 bg-gray-200 rounded font-bold text-gray-600">取消</button>
                      <button type="submit" className="flex-1 py-2 bg-brand-600 text-white rounded font-bold">保存</button>
                   </div>
               </form>
            ) : (
                <div className="space-y-3">
                   {barbers.map(barber => (
                       <div key={barber.id} className="flex items-center gap-3 p-3 border rounded-xl">
                           <img src={barber.avatarUrl} className="w-10 h-10 rounded-full bg-gray-100 object-cover" />
                           <div className="flex-1 min-w-0">
                               <div className="font-bold truncate">{barber.name}</div>
                               <div className="text-xs text-gray-500 truncate">{barber.specialty}</div>
                           </div>
                           <div className="flex gap-1">
                               <button onClick={() => showBarberQr(barber)} className="p-2 text-gray-500 bg-gray-50 rounded"><QrCode size={16}/></button>
                               <button onClick={() => startEditBarber(barber)} className="p-2 text-brand-600 bg-brand-50 rounded"><Edit2 size={16}/></button>
                               <button onClick={() => handleDeleteBarber(barber.id)} className="p-2 text-red-600 bg-red-50 rounded"><Trash2 size={16}/></button>
                           </div>
                       </div>
                   ))}
                </div>
            )}
          </section>

          <section className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">所有预约</h3>
                <button onClick={loadData}><RefreshCw size={16} className="text-gray-400"/></button>
             </div>
             <div className="overflow-x-auto -mx-4 px-4">
                 <table className="w-full text-sm min-w-[500px]">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase"><tr><th className="p-2 text-left">时间</th><th className="p-2 text-left">客户</th><th className="p-2 text-left">理发师</th><th className="p-2">状态</th><th className="p-2"></th></tr></thead>
                    <tbody className="divide-y divide-gray-50">
                        {appointments.map(app => (
                            <tr key={app.id}>
                                <td className="p-2"><div>{app.date.slice(5)}</div><div className="text-xs text-gray-400">{app.timeSlot}</div></td>
                                <td className="p-2"><div>{app.customerName}</div><div className="text-xs text-gray-400">{app.customerPhone}</div></td>
                                <td className="p-2 text-gray-500 text-xs">{barbers.find(b => b.id === app.barberId)?.name}</td>
                                <td className="p-2 text-center"><span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${app.status === 'BOOKED' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{app.status}</span></td>
                                <td className="p-2 text-right">{app.status === 'BOOKED' && <button onClick={() => cancelAppointment(app.id)} className="text-red-400"><Trash2 size={14}/></button>}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
             </div>
          </section>
        </>
      )}

      {activeTab === 'LOGS' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-gray-50 font-bold flex items-center gap-2"><Activity size={18}/> 最近日志</div>
             <div className="overflow-x-auto">
                 <table className="w-full text-sm min-w-[300px]">
                     <tbody className="divide-y divide-gray-50">
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td className="p-3 text-xs text-gray-400 font-mono w-24">{format(new Date(log.timestamp), 'MM-dd HH:mm')}</td>
                                <td className="p-3">
                                    <div className="font-bold text-gray-800 text-xs mb-0.5">{log.action}</div>
                                    <div className="text-xs text-gray-500">{log.details}</div>
                                </td>
                            </tr>
                        ))}
                     </tbody>
                 </table>
             </div>
          </div>
      )}
    </div>
  );
};
