
import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { StorageService } from '../services/storageService';
import { SystemSettings, Appointment, AppointmentStatus, Barber, LogEntry } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { Save, Settings as SettingsIcon, Trash2, Loader2, RefreshCw, Database, Link, Users, Plus, Edit2, X, QrCode, Upload, Image as ImageIcon, ScrollText, Activity, Lock } from 'lucide-react';
import { format } from 'date-fns';

interface AdminPanelProps {
}

export const AdminPanel: React.FC<AdminPanelProps> = () => {
  const [activeTab, setActiveTab] = useState<'SETTINGS' | 'LOGS'>('SETTINGS');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Database Connection State
  const [dbConfig, setDbConfig] = useState({ url: '', key: '' });
  const [dbStatus, setDbStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isEnvConfigured, setIsEnvConfigured] = useState(false);

  // Barber Editing State
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QR Display State
  const [viewingBarberQr, setViewingBarberQr] = useState<{barber: Barber, url: string} | null>(null);

  useEffect(() => {
    loadData();
    
    // Check Config Source
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
    // Refresh logs after save
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
      // Reload data with new connection
      await loadData();
      setTimeout(() => setDbStatus('idle'), 3000);
    } catch (e) {
      setDbStatus('error');
    }
  };

  const cancelAppointment = async (id: string) => {
    if (confirm('确定要取消这个预约吗？')) {
      // Optimistic update
      setAppointments(prev => prev.map(a => 
        a.id === id ? { ...a, status: AppointmentStatus.CANCELLED } : a
      ));
      await StorageService.updateAppointmentStatus(id, AppointmentStatus.CANCELLED);
      // Reload to ensure sync and get logs
      await loadData();
    }
  };

  const handleSaveBarber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBarber) return;
    
    setIsSaving(true);
    let newBarbers = [...barbers];
    const index = newBarbers.findIndex(b => b.id === editingBarber.id);
    
    if (index >= 0) {
      newBarbers[index] = editingBarber;
    } else {
      newBarbers.push(editingBarber);
    }
    
    await StorageService.saveBarbers(newBarbers);
    setBarbers(newBarbers);
    setEditingBarber(null);
    setIsSaving(false);
    // Refresh logs
    const l = await StorageService.getLogs();
    setLogs(l);
  };

  const handleDeleteBarber = async (id: string) => {
    if (!confirm("确定要删除这位理发师吗？这可能会影响历史预约数据的显示。")) return;
    
    await StorageService.deleteBarber(id);
    setBarbers(prev => prev.filter(b => b.id !== id));
    // Refresh logs
    const l = await StorageService.getLogs();
    setLogs(l);
  };

  const startEditBarber = (barber?: Barber) => {
    if (barber) {
      setEditingBarber({ ...barber });
    } else {
      setEditingBarber({
        id: crypto.randomUUID(),
        name: '',
        specialty: '',
        bio: '',
        avatarUrl: `https://picsum.photos/100/100?random=${Math.floor(Math.random() * 1000)}`
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("图片大小不能超过 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize logic to prevent huge base64 strings
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxSize = 300; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG 0.8 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setEditingBarber(prev => prev ? ({...prev, avatarUrl: dataUrl}) : null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const showBarberQr = async (barber: Barber) => {
      try {
          // Special prefix to distinguish from normal appointments
          const qrData = `BARBER_BOOK:${barber.id}`;
          const url = await QRCode.toDataURL(qrData, { width: 400 });
          setViewingBarberQr({ barber, url });
      } catch (e) {
          console.error("Failed to generate QR", e);
      }
  };

  const getStatusLabel = (status: AppointmentStatus) => {
    switch (status) {
      case AppointmentStatus.BOOKED: return '已预约';
      case AppointmentStatus.COMPLETED: return '已完成';
      case AppointmentStatus.CANCELLED: return '已取消';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500 gap-2">
         <Loader2 className="animate-spin" /> 加载配置...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">后台管理中心</h1>
          <p className="text-xs text-gray-500">开放访问模式 | v1.0.4</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button 
             onClick={() => setActiveTab('SETTINGS')}
             className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'SETTINGS' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <SettingsIcon size={16} /> 业务管理
          </button>
          <button 
             onClick={() => setActiveTab('LOGS')}
             className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'LOGS' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <ScrollText size={16} /> 系统日志
          </button>
        </div>
      </div>
      
      {/* Barber QR Modal */}
      {viewingBarberQr && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setViewingBarberQr(null)}>
              <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
                  <h3 className="text-xl font-bold mb-2">{viewingBarberQr.barber.name}</h3>
                  <p className="text-gray-500 mb-6 text-sm">扫码直接预约该理发师</p>
                  <div className="flex justify-center mb-6">
                      <img src={viewingBarberQr.url} alt="QR Code" className="w-64 h-64 border border-gray-100 rounded-lg" />
                  </div>
                  <button 
                    onClick={() => setViewingBarberQr(null)}
                    className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold"
                  >
                    关闭
                  </button>
              </div>
          </div>
      )}

      {/* Database Connection Section (Always Visible) */}
      <section className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <details className="group">
           <summary className="flex items-center gap-2 font-bold text-gray-700 cursor-pointer list-none">
              <Database size={18} className="text-brand-600" />
              <span>数据存储连接 (Supabase)</span>
              <span className="text-xs font-normal text-gray-400 ml-2 group-open:hidden">点击展开配置...</span>
              {isEnvConfigured && (
                  <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                      <Lock size={10} /> 环境变量已生效
                  </span>
              )}
           </summary>
           <div className="space-y-4 mt-4 animate-in fade-in slide-in-from-top-2">
              {isEnvConfigured ? (
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg text-sm text-gray-600 flex items-center gap-3">
                  <div className="bg-white p-2 rounded-full border border-gray-100 shadow-sm">
                    <Lock size={20} className="text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">已从环境变量加载配置</h4>
                    <p className="mt-1">数据库连接已通过环境变量 (SUPABASE_URL, SUPABASE_KEY) 锁定。如需修改，请更新系统环境参数。</p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Project URL</label>
                    <input 
                      type="text" 
                      value={dbConfig.url}
                      onChange={(e) => setDbConfig({...dbConfig, url: e.target.value})}
                      placeholder="https://xyz.supabase.co"
                      className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Anon Public Key</label>
                    <input 
                      type="password" 
                      value={dbConfig.key}
                      onChange={(e) => setDbConfig({...dbConfig, key: e.target.value})}
                      placeholder="eyJh..."
                      className="w-full p-2 border border-gray-300 rounded-md font-mono text-sm"
                    />
                  </div>
                </>
              )}
              
              <div className="flex items-center justify-between mt-4">
                <span className={`text-sm ${
                  dbStatus === 'success' ? 'text-green-600' : 
                  dbStatus === 'error' ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {dbStatus === 'success' ? '连接已更新并重新加载！' : 
                  dbStatus === 'error' ? '配置格式无效。' : 
                  isEnvConfigured ? '当前使用环境变量。' : '留空则使用本地模拟模式。'}
                </span>
                
                {!isEnvConfigured && (
                  <button 
                    onClick={handleSaveDbConfig}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                  >
                    <Link size={18} />
                    连接数据库
                  </button>
                )}
              </div>
           </div>
        </details>
      </section>

      {/* --- LOGS TAB --- */}
      {activeTab === 'LOGS' && (
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-left-4">
           <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Activity className="text-brand-600" />
                <h2 className="text-xl font-bold text-gray-800">系统操作日志</h2>
              </div>
              <button onClick={loadData} className="text-sm text-gray-500 hover:text-brand-600 flex items-center gap-1">
                 <RefreshCw size={14} /> 刷新
              </button>
           </div>
           
           <div className="overflow-hidden border border-gray-100 rounded-lg">
             <table className="w-full text-sm text-left">
               <thead className="bg-gray-50 text-gray-600 font-medium">
                 <tr>
                   <th className="p-3">时间</th>
                   <th className="p-3">操作类型</th>
                   <th className="p-3">详情</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {logs.length === 0 ? (
                   <tr>
                     <td colSpan={3} className="p-8 text-center text-gray-400">暂无操作记录</td>
                   </tr>
                 ) : (
                   logs.map(log => (
                     <tr key={log.id} className="hover:bg-gray-50">
                       <td className="p-3 whitespace-nowrap text-gray-500 font-mono text-xs">
                         {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                       </td>
                       <td className="p-3">
                         <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                           log.action.includes('删除') || log.action.includes('取消') ? 'bg-red-50 text-red-700' :
                           log.action.includes('配置') ? 'bg-orange-50 text-orange-700' :
                           log.action.includes('创建') ? 'bg-green-50 text-green-700' :
                           'bg-blue-50 text-blue-700'
                         }`}>
                           {log.action}
                         </span>
                       </td>
                       <td className="p-3 text-gray-700">{log.details}</td>
                     </tr>
                   ))
                 )}
               </tbody>
             </table>
           </div>
        </section>
      )}

      {/* --- SETTINGS TAB --- */}
      {activeTab === 'SETTINGS' && (
        <>
          {/* Settings Section */}
          <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b pb-4">
              <SettingsIcon className="text-gray-500" />
              <h2 className="text-xl font-bold text-gray-800">系统业务配置</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">每日每位理发师最大预约数</label>
                <input 
                  type="number" 
                  value={settings.maxSlotsPerBarberPerDay}
                  onChange={(e) => setSettings({...settings, maxSlotsPerBarberPerDay: parseInt(e.target.value) || 0})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">服务时长（分钟）</label>
                <select 
                  value={settings.slotDurationMinutes}
                  onChange={(e) => setSettings({...settings, slotDurationMinutes: parseInt(e.target.value)})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value={30}>30 分钟</option>
                  <option value={45}>45 分钟</option>
                  <option value={60}>60 分钟</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">开门时间</label>
                <input 
                  type="time" 
                  value={settings.openingTime}
                  onChange={(e) => setSettings({...settings, openingTime: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关门时间</label>
                <input 
                  type="time" 
                  value={settings.closingTime}
                  onChange={(e) => setSettings({...settings, closingTime: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              {saved && <span className="text-green-600 text-sm font-medium animate-fade-out">设置已保存！</span>}
              <button 
                disabled={isSaving}
                onClick={handleSaveSettings}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors disabled:opacity-70"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {isSaving ? '保存中...' : '保存配置'}
              </button>
            </div>
          </section>

          {/* Barbers Management Section */}
          <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6 border-b pb-4">
              <div className="flex items-center gap-2">
                <Users className="text-gray-500" />
                <h2 className="text-xl font-bold text-gray-800">理发师管理</h2>
              </div>
              <button 
                onClick={() => startEditBarber()}
                className="flex items-center gap-1 text-sm bg-brand-50 text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-100 font-medium"
              >
                <Plus size={16} /> 添加理发师
              </button>
            </div>

            {editingBarber ? (
              <form onSubmit={handleSaveBarber} className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
                <h3 className="font-bold text-gray-800 mb-4">{barbers.find(b => b.id === editingBarber.id) ? '编辑理发师' : '添加新理发师'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                      <input 
                        required
                        type="text" 
                        value={editingBarber.name}
                        onChange={e => setEditingBarber({...editingBarber, name: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">专长</label>
                      <input 
                        required
                        type="text" 
                        value={editingBarber.specialty}
                        onChange={e => setEditingBarber({...editingBarber, specialty: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                   </div>
                   <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">简介</label>
                      <textarea 
                        value={editingBarber.bio}
                        onChange={e => setEditingBarber({...editingBarber, bio: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        rows={2}
                      />
                   </div>
                   <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">头像设置</label>
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 bg-white border border-dashed border-gray-300 rounded-lg">
                        <img 
                          src={editingBarber.avatarUrl} 
                          alt="Preview" 
                          className="w-20 h-20 rounded-full bg-gray-100 object-cover shadow-sm flex-shrink-0" 
                          onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/100?text=Error')} 
                        />
                        
                        <div className="flex-1 w-full space-y-2">
                          <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <div className="flex gap-2">
                            <button 
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium transition-colors"
                            >
                              <Upload size={16} />
                              上传图片
                            </button>
                            <span className="text-xs text-gray-400 self-center">支持 JPG/PNG (自动压缩)</span>
                          </div>
                          
                          <div className="flex items-center gap-2 w-full">
                            <Link size={14} className="text-gray-400" />
                            <input 
                              type="text" 
                              placeholder="或直接粘贴图片 URL"
                              value={editingBarber.avatarUrl}
                              onChange={e => setEditingBarber({...editingBarber, avatarUrl: e.target.value})}
                              className="flex-1 p-2 text-xs border border-gray-200 rounded-md bg-gray-50 focus:bg-white transition-colors"
                            />
                          </div>
                        </div>
                      </div>
                   </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => setEditingBarber(null)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                  >
                    取消
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
                  >
                    {isSaving && <Loader2 className="animate-spin" size={16} />}
                    保存
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {barbers.map(barber => (
                  <div key={barber.id} className="bg-white p-4 rounded-lg border border-gray-100 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow group">
                    <img src={barber.avatarUrl} alt={barber.name} className="w-12 h-12 rounded-full object-cover bg-gray-100" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate">{barber.name}</h4>
                      <p className="text-xs text-gray-500 mb-2 truncate">{barber.specialty}</p>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => showBarberQr(barber)} className="text-gray-600 hover:bg-gray-100 p-1 rounded" title="显示预约二维码">
                          <QrCode size={16} />
                        </button>
                        <button onClick={() => startEditBarber(barber)} className="text-brand-600 hover:bg-brand-50 p-1 rounded" title="编辑">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteBarber(barber.id)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="删除">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {barbers.length === 0 && (
                  <div className="col-span-full text-center text-gray-400 py-8">
                    暂无理发师，请点击右上角添加。
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Stats / List */}
          <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">所有预约</h2>
              <button onClick={loadData} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                <RefreshCw size={18} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 uppercase font-medium">
                  <tr>
                    <th className="p-3">日期/时间</th>
                    <th className="p-3">客户信息</th>
                    <th className="p-3">理发师</th>
                    <th className="p-3">状态</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {appointments.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center">暂无预约。</td></tr>
                  ) : (
                    appointments.map(app => {
                      return (
                        <tr key={app.id}>
                          <td className="p-3">
                             <div className="font-medium text-gray-900">{app.date}</div>
                             <div className="text-xs text-gray-500">{app.timeSlot}</div>
                          </td>
                          <td className="p-3">
                             <div className="font-medium text-gray-900">{app.customerName || '未填写'}</div>
                             <div className="text-xs text-gray-500 font-mono">{app.customerPhone || '-'}</div>
                          </td>
                          <td className="p-3"><span className="font-mono text-xs text-gray-400">{barbers.find(b => b.id === app.barberId)?.name || app.barberId.slice(0,4)}</span></td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              app.status === AppointmentStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                              app.status === AppointmentStatus.CANCELLED ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {getStatusLabel(app.status)}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            {app.status === AppointmentStatus.BOOKED && (
                              <button 
                                onClick={() => cancelAppointment(app.id)}
                                className="text-red-500 hover:bg-red-50 p-1 rounded"
                                title="取消"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
