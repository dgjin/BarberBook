
import React, { useState, useEffect } from 'react';
import { User, Appointment, AppointmentStatus, Barber } from '../types';
import { StorageService } from '../services/storageService';
import { User as UserIcon, Phone, Camera, LogOut, ChevronRight, Calendar, History, Loader2, Save } from 'lucide-react';
import QRCode from 'qrcode';

interface UserProfileProps {
  currentUser: User;
  appointments: Appointment[];
  barbers: Barber[];
  onLogout: () => void;
  onUserUpdate: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ currentUser, appointments, barbers, onLogout, onUserUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    setName(currentUser.name);
    setPhone(currentUser.phone);
    setAvatarUrl(currentUser.avatarUrl);
  }, [currentUser]);

  useEffect(() => {
    const generateQRs = async () => {
        const newQrUrls: Record<string, string> = {};
        const myApps = appointments.filter(a => a.userId === currentUser.id && a.status === AppointmentStatus.BOOKED);
        for (const app of myApps) {
            try { newQrUrls[app.id] = await QRCode.toDataURL(app.id); } catch (e) {}
        }
        setQrUrls(newQrUrls);
    };
    generateQRs();
  }, [appointments, currentUser.id]);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) { alert("请填写完整信息"); return; }
    setSaving(true);
    const result = await StorageService.updateUser({ ...currentUser, name, phone, avatarUrl });
    if (result.success) {
        setIsEditing(false);
        onUserUpdate();
    } else {
        alert(result.message || "更新失败");
    }
    setSaving(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("图片过大"); return; }

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
        setAvatarUrl(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const myAppointments = appointments.filter(a => a.userId === currentUser.id);
  const upcomingApps = myAppointments.filter(a => a.status === AppointmentStatus.BOOKED).sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));
  const historyApps = myAppointments.filter(a => a.status !== AppointmentStatus.BOOKED).sort((a, b) => (b.date + b.timeSlot).localeCompare(a.date + a.timeSlot));

  return (
    <div className="pb-10">
      {/* Header Profile */}
      <div className="flex flex-col items-center mb-8 pt-4">
        <div className="relative group">
            <img 
                src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`} 
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg bg-gray-100"
            />
            {isEditing && (
                <label className="absolute bottom-0 right-0 bg-brand-600 p-2 rounded-full text-white shadow-md cursor-pointer active:scale-95 transition-transform">
                    <Camera size={16} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
            )}
        </div>
        {!isEditing && (
            <div className="mt-4 text-center">
                <h2 className="text-xl font-bold text-gray-900">{currentUser.name}</h2>
                <p className="text-sm text-gray-500">@{currentUser.username}</p>
                <button onClick={() => setIsEditing(true)} className="mt-2 text-xs text-brand-600 bg-brand-50 px-3 py-1 rounded-full font-bold">
                    编辑资料
                </button>
            </div>
        )}
      </div>

      {/* Edit Form */}
      {isEditing && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 space-y-4 animate-in fade-in">
              <div>
                  <label className="text-xs text-gray-400 font-bold uppercase ml-1">姓名</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                  <label className="text-xs text-gray-400 font-bold uppercase ml-1">电话</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full mt-1 p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="flex gap-3 pt-2">
                  <button onClick={() => { setIsEditing(false); setName(currentUser.name); }} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">取消</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold flex justify-center gap-2">
                      {saving ? <Loader2 className="animate-spin" /> : <Save size={18} />} 保存
                  </button>
              </div>
          </div>
      )}

      {/* Tabs */}
      <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
          <button onClick={() => setActiveTab('UPCOMING')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'UPCOMING' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>进行中</button>
          <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'HISTORY' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>历史</button>
      </div>

      {/* Lists */}
      <div className="space-y-3">
          {activeTab === 'UPCOMING' ? (
              upcomingApps.length === 0 ? <EmptyState text="暂无进行中的预约" /> : 
              upcomingApps.map(app => (
                  <div key={app.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-4">
                      <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">进行中</span>
                              <span className="text-xs text-gray-400">{app.date}</span>
                          </div>
                          <h3 className="font-bold text-gray-900">{barbers.find(b => b.id === app.barberId)?.name}</h3>
                          <div className="text-2xl font-bold text-brand-600 my-1">{app.timeSlot}</div>
                          <p className="text-xs text-gray-400">请出示右侧二维码签到</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-xl flex items-center justify-center">
                          {qrUrls[app.id] ? <img src={qrUrls[app.id]} className="w-20 h-20 mix-blend-multiply" /> : <div className="w-20 h-20 bg-gray-200 animate-pulse rounded" />}
                      </div>
                  </div>
              ))
          ) : (
              historyApps.length === 0 ? <EmptyState text="暂无历史记录" /> :
              historyApps.map(app => (
                  <div key={app.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                      <div>
                          <h3 className="font-bold text-gray-700 text-sm">{barbers.find(b => b.id === app.barberId)?.name}</h3>
                          <p className="text-xs text-gray-400 mt-1">{app.date} {app.timeSlot}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-lg font-bold ${
                          app.status === AppointmentStatus.COMPLETED ? 'bg-green-50 text-green-600' :
                          app.status === AppointmentStatus.CANCELLED ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                          {app.status === AppointmentStatus.COMPLETED ? '已完成' : app.status === AppointmentStatus.CANCELLED ? '已取消' : '已过期'}
                      </span>
                  </div>
              ))
          )}
      </div>

      <div className="mt-8 border-t border-gray-100 pt-6">
          <button onClick={onLogout} className="w-full flex items-center justify-between p-4 bg-white border border-red-100 rounded-2xl text-red-600 font-bold active:bg-red-50 transition-colors">
              <span className="flex items-center gap-2"><LogOut size={18} /> 退出登录</span>
              <ChevronRight size={18} className="text-red-300" />
          </button>
      </div>
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-300">
        <History size={48} className="mb-2 opacity-50" />
        <p className="text-sm">{text}</p>
    </div>
);
