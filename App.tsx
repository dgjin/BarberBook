import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode'; // Standard import
import { ViewState, Appointment, AppointmentStatus, Barber } from './types';
import { StorageService } from './services/storageService';
import { BookingFlow } from './components/BookingFlow';
import { AdminPanel } from './components/AdminPanel';
import { QRScanner } from './components/QRScanner';
import { AIAdvisor } from './components/AIAdvisor';
import { ScheduleDashboard } from './components/ScheduleDashboard';
import { format } from 'date-fns';
import { 
  Scissors, 
  PlusCircle, 
  CalendarCheck, 
  Settings, 
  QrCode, 
  CheckCircle,
  Home,
  LogOut,
  Sparkles,
  Loader2,
  Trash2,
  Clock,
  User,
  AlertTriangle
} from 'lucide-react';

function App() {
  const [view, setView] = useState<ViewState>('HOME');
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  // Enhanced scan result state to include specific messages
  const [scanResult, setScanResult] = useState<{app: Appointment, success: boolean, message?: string} | null>(null);
  
  // New state for Scan to Book
  const [preSelectedBarberId, setPreSelectedBarberId] = useState<string | null>(null);

  // For generating QR codes in the UI
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    refreshData();
  }, [view]);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [apps, barberList] = await Promise.all([
        StorageService.getAppointments(),
        StorageService.getBarbers()
      ]);
      
      // Sort by date/time (simple string sort works for ISO dates and HH:mm)
      apps.sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));
      setAppointments(apps);
      setBarbers(barberList);

      // Generate QRs for booked apps
      const newQrUrls = { ...qrUrls };
      for (const app of apps) {
        if (app.status === AppointmentStatus.BOOKED && !newQrUrls[app.id]) {
          try {
            newQrUrls[app.id] = await QRCode.toDataURL(app.id);
          } catch (err) {
            console.error(err);
          }
        }
      }
      setQrUrls(newQrUrls);
    } catch (e) {
      console.error("Failed to refresh data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = async (scannedApp: Appointment) => {
    // Need to verify status freshly from DB to avoid stale closures
    const currentApps = await StorageService.getAppointments();
    const app = currentApps.find(a => a.id === scannedApp.id) || scannedApp;

    // 1. Check basic status
    if (app.status !== AppointmentStatus.BOOKED) {
      setScanResult({ 
          app, 
          success: false, 
          message: `该预约状态为 ${getStatusText(app.status)}，无法签到。` 
      }); 
      return;
    }

    // 2. Queue Logic Check:
    // Ensure no earlier BOOKED appointments exist for this barber on this day.
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (app.date === todayStr) {
        const unfinishedPriorApps = currentApps.filter(a => 
            a.barberId === app.barberId &&
            a.date === app.date &&
            a.status === AppointmentStatus.BOOKED &&
            a.timeSlot < app.timeSlot // Compare time strings "09:00" < "10:00"
        );

        if (unfinishedPriorApps.length > 0) {
            setScanResult({ 
                app, 
                success: false, 
                message: `无法签到！前方还有 ${unfinishedPriorApps.length} 位预约顾客（${unfinishedPriorApps[0].timeSlot}等）未完成理发。请按顺序排队。` 
            }); 
            return;
        }
    }

    // 3. Process Check-in
    const success = await StorageService.updateAppointmentStatus(app.id, AppointmentStatus.COMPLETED);
    if (success) {
      setScanResult({ 
          app, 
          success: true,
          message: `签到成功！${app.timeSlot} 的服务现在开始。`
      });
      refreshData(); // Refresh list
    } else {
       setScanResult({ 
           app, 
           success: false,
           message: "系统更新失败，请重试。" 
       }); 
    }
    setView('HOME'); // Return to home but show modal
  };

  const handleScanBooking = (barberId: string) => {
    setPreSelectedBarberId(barberId);
    setView('BOOKING');
  };

  const handleCancelAppointment = async (id: string) => {
    if (confirm('确定要取消这个预约吗？取消后该时间段将立即释放给其他客户。')) {
      setLoading(true);
      await StorageService.updateAppointmentStatus(id, AppointmentStatus.CANCELLED);
      await refreshData();
    }
  };

  const activeAppointments = appointments.filter(a => a.status === AppointmentStatus.BOOKED);

  const NavbarItem = ({ icon: Icon, label, target }: { icon: any, label: string, target: ViewState }) => (
    <button
      onClick={() => { setView(target); setPreSelectedBarberId(null); }}
      className={`flex flex-col items-center p-2 text-xs font-medium transition-colors ${
        view === target ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <Icon size={24} className="mb-1" />
      {label}
    </button>
  );

  const getStatusText = (status: AppointmentStatus) => {
     switch(status) {
         case AppointmentStatus.BOOKED: return '已预约';
         case AppointmentStatus.COMPLETED: return '已完成';
         case AppointmentStatus.CANCELLED: return '已取消';
         default: return status;
     }
  };

  // Helper to render Today's Queue
  const TodayQueueDashboard = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    return (
        <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
                <Clock className="text-brand-600" />
                今日排队动态 <span className="text-sm font-normal text-gray-500">({todayStr})</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {barbers.map(barber => {
                    const dailyApps = appointments
                        .filter(a => a.barberId === barber.id && a.date === todayStr && a.status !== AppointmentStatus.CANCELLED)
                        .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
                    
                    if (dailyApps.length === 0) return null;

                    // Find the next person to serve (first BOOKED)
                    const nextUpIndex = dailyApps.findIndex(a => a.status === AppointmentStatus.BOOKED);

                    return (
                        <div key={barber.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-3 border-b border-gray-100 pb-2">
                                <img src={barber.avatarUrl} alt={barber.name} className="w-10 h-10 rounded-full object-cover" />
                                <div>
                                    <h3 className="font-bold text-gray-800">{barber.name}</h3>
                                    <p className="text-xs text-gray-500">今日预约: {dailyApps.length} 人</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                {dailyApps.map((app, index) => {
                                    const isCompleted = app.status === AppointmentStatus.COMPLETED;
                                    const isNext = index === nextUpIndex;
                                    
                                    return (
                                        <div 
                                            key={app.id}
                                            className={`
                                                relative p-2 rounded-lg text-xs font-medium border flex flex-col items-center justify-center gap-0.5 min-w-[70px]
                                                ${isCompleted 
                                                    ? 'bg-green-50 text-green-700 border-green-200' 
                                                    : isNext 
                                                        ? 'bg-brand-600 text-white border-brand-600 shadow-md ring-2 ring-brand-100' 
                                                        : 'bg-gray-50 text-gray-400 border-gray-200'}
                                            `}
                                        >
                                            <div className="flex items-center gap-1">
                                              {isCompleted && <CheckCircle size={10} />}
                                              {isNext && <span className="animate-pulse w-1.5 h-1.5 bg-white rounded-full"></span>}
                                              <span className="font-bold">{app.timeSlot}</span>
                                            </div>
                                            <span className={`truncate max-w-[60px] text-[10px] ${isNext ? 'text-brand-100' : 'text-gray-500'}`}>
                                              {app.customerName || '顾客'}
                                            </span>
                                            {isNext && <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] px-1 rounded-full z-10">当前</div>}
                                        </div>
                                    );
                                })}
                            </div>
                            {nextUpIndex === -1 && dailyApps.length > 0 && (
                                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                                    <CheckCircle size={12} /> 今日预约已全部完成
                                </p>
                            )}
                             {nextUpIndex === -1 && dailyApps.length === 0 && (
                                <p className="text-xs text-gray-400 mt-2">今日暂无预约</p>
                            )}
                        </div>
                    );
                })}
                {barbers.length === 0 && <div className="text-gray-400 text-sm">暂无理发师数据。</div>}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-600" onClick={() => setView('HOME')}>
            <Scissors className="transform -scale-x-100" />
            <span className="text-xl font-bold tracking-tight">BarberBook</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => setView('HOME')} className={`text-sm font-medium ${view === 'HOME' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-900'}`}>主页</button>
            <button onClick={() => { setView('BOOKING'); setPreSelectedBarberId(null); }} className={`text-sm font-medium ${view === 'BOOKING' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-900'}`}>立即预约</button>
            <button onClick={() => setView('AI_ADVISOR')} className={`text-sm font-medium ${view === 'AI_ADVISOR' ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600'}`}>AI 顾问</button>
            <button onClick={() => setView('ADMIN')} className={`text-sm font-medium ${view === 'ADMIN' ? 'text-brand-600' : 'text-gray-500 hover:text-gray-900'}`}>管理后台</button>
          </div>
          <button 
            onClick={() => setView('SCANNER')}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-black transition-colors"
          >
            <QrCode size={18} />
            <span className="hidden sm:inline">扫码预约/签到</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 min-h-[calc(100vh-64px)]">
        
        {/* Success/Status Modal for Scan */}
        {scanResult && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                scanResult.success ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
              }`}>
                {scanResult.success ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
                {scanResult.success ? '签到成功！' : '操作受阻'}
              </h3>
              <p className="text-center text-gray-500 mb-6 text-sm">
                {scanResult.message || (scanResult.success 
                  ? `已成功签到 ${scanResult.app.timeSlot} 的预约。资源已释放。` 
                  : `此预约当前状态为：${getStatusText(scanResult.app.status)}。`)}
              </p>
              <button 
                onClick={() => setScanResult(null)}
                className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-black"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {/* Dashboard View */}
        {view === 'HOME' && (
          <div className="space-y-6">
            
            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div 
                onClick={() => { setPreSelectedBarberId(null); setView('BOOKING'); }}
                className="bg-gradient-to-br from-brand-500 to-brand-600 p-6 rounded-2xl text-white shadow-lg shadow-brand-200 cursor-pointer hover:scale-[1.02] transition-transform"
              >
                <PlusCircle size={32} className="mb-4 opacity-80" />
                <h3 className="font-bold text-lg">新预约</h3>
                <p className="text-brand-100 text-sm">预约理发</p>
              </div>
              
              <div 
                onClick={() => setView('AI_ADVISOR')}
                className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200 cursor-pointer hover:scale-[1.02] transition-transform"
              >
                <Sparkles size={32} className="mb-4 opacity-80" />
                <h3 className="font-bold text-lg">发型顾问</h3>
                <p className="text-indigo-100 text-sm">询问 AI 建议</p>
              </div>
            </div>

            {/* Today's Queue Dashboard (NEW) */}
            {!loading && <TodayQueueDashboard />}

            {/* Weekly Schedule Dashboard */}
            {!loading && barbers.length > 0 && (
              <ScheduleDashboard appointments={appointments} barbers={barbers} />
            )}

            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mt-8">
              <CalendarCheck className="text-brand-600" />
              我的当前预约
            </h2>

            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-brand-500" size={32} />
              </div>
            ) : activeAppointments.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                <p className="text-gray-400">暂无即将到来的预约。</p>
                <button onClick={() => { setPreSelectedBarberId(null); setView('BOOKING'); }} className="mt-2 text-brand-600 font-medium hover:underline">立即预约</button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAppointments.map(app => (
                  <div key={app.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-brand-100 text-brand-700 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                          即将到来
                        </span>
                        <span className="text-sm text-gray-400">ID: {app.id.slice(0, 6)}...</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {barbers.find(b => b.id === app.barberId)?.name || '未知理发师'}
                      </h3>
                      <p className="text-gray-600 flex items-center gap-2 mt-1">
                        <span className="font-medium">{app.date}</span> 时间：<span className="font-medium">{app.timeSlot}</span>
                      </p>
                      
                      <div className="mt-4 flex flex-wrap gap-2 items-center justify-between">
                         <p className="text-xs text-gray-400">请在柜台出示二维码签到。</p>
                         <button 
                            onClick={() => handleCancelAppointment(app.id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-md border border-red-200 transition-colors"
                         >
                            <Trash2 size={12} />
                            取消预约
                         </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                      {qrUrls[app.id] ? (
                        <img src={qrUrls[app.id]} alt="QR Code" className="w-24 h-24 mix-blend-multiply" />
                      ) : (
                        <div className="w-24 h-24 bg-gray-200 animate-pulse rounded" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'BOOKING' && (
          <BookingFlow 
            onComplete={() => { setView('HOME'); setPreSelectedBarberId(null); }}
            onCancel={() => { setView('HOME'); setPreSelectedBarberId(null); }}
            preSelectedBarberId={preSelectedBarberId}
          />
        )}

        {view === 'SCANNER' && (
          <QRScanner 
            onScanSuccess={handleScanSuccess}
            onScanBooking={handleScanBooking}
            onClose={() => setView('HOME')}
          />
        )}

        {/* Admin Logic - No Login Required */}
        {view === 'ADMIN' && (
           <AdminPanel />
        )}
        
        {view === 'AI_ADVISOR' && <AIAdvisor />}

      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden justify-around pb-safe pt-1">
        <NavbarItem icon={Home} label="主页" target="HOME" />
        <NavbarItem icon={PlusCircle} label="预约" target="BOOKING" />
        <NavbarItem icon={Sparkles} label="AI" target="AI_ADVISOR" />
        <NavbarItem icon={Settings} label="管理" target="ADMIN" />
      </nav>
    </div>
  );
}

export default App;