
import { useState, useEffect } from 'react';
import QRCode from 'qrcode'; 
import { ViewState, Appointment, AppointmentStatus, Barber, SystemSettings, User } from './types';
import { StorageService } from './services/storageService';
import { BookingFlow } from './components/BookingFlow';
import { AdminPanel } from './components/AdminPanel';
import { QRScanner } from './components/QRScanner';
import { AIAdvisor } from './components/AIAdvisor';
import { Auth } from './components/Auth';
import { ScheduleDashboard } from './components/ScheduleDashboard';
import { UserProfile } from './components/UserProfile';
import { format, differenceInMinutes } from 'date-fns';
import { DEFAULT_SETTINGS } from './constants';
import { 
  Scissors, 
  PlusCircle, 
  Settings, 
  QrCode, 
  CheckCircle,
  Home,
  Sparkles,
  Loader2,
  Trash2,
  Clock,
  User as UserIcon,
  AlertTriangle,
  Bell,
  X
} from 'lucide-react';

function App() {
  const [view, setView] = useState<ViewState>('HOME');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [scanResult, setScanResult] = useState<{app: Appointment, success: boolean, message?: string} | null>(null);
  const [preSelectedBarberId, setPreSelectedBarberId] = useState<string | null>(null);
  const [upcomingReminder, setUpcomingReminder] = useState<Appointment | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const wechatCode = urlParams.get('code');
            
            if (wechatCode) {
                setAuthLoading(true);
                window.history.replaceState({}, document.title, window.location.pathname);
                const result = await StorageService.loginWithWeChatCode(wechatCode);
                if (result.success && result.user) {
                    setCurrentUser(result.user);
                    setView('HOME');
                } else {
                    alert('微信登录失败: ' + result.message);
                }
                setAuthLoading(false);
            } else {
                const user = StorageService.getCurrentUser();
                setCurrentUser(user);
            }
            
            const s = await StorageService.getSettings();
            setSettings(s);
            await refreshData();
        } catch(e) { console.error(e); }
        setLoading(false);
    };
    init();

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []); 

  useEffect(() => {
    const runChecks = async () => {
      await refreshData();
      if (appointments.length === 0) return;

      const now = new Date();
      const activeApps = appointments.filter(a => a.status === AppointmentStatus.BOOKED);
      const duration = settings.slotDurationMinutes || 45;

      for (const app of activeApps) {
         try {
             const appDateTimeStr = `${app.date}T${app.timeSlot}:00`;
             const appStartTime = new Date(appDateTimeStr);
             const appEndTime = new Date(appStartTime.getTime() + duration * 60 * 1000);

             if (now > appEndTime) {
                 await StorageService.updateAppointmentStatus(app.id, AppointmentStatus.EXPIRED);
             }
         } catch (e) {
             console.error("Expiration check error", e);
         }
      }

      if (currentUser) {
          const myActiveApps = activeApps.filter(a => a.userId === currentUser.id);
          const imminentApp = myActiveApps.find(app => {
            const appDateTimeStr = `${app.date}T${app.timeSlot}:00`;
            const appDate = new Date(appDateTimeStr);
            const diffMinutes = differenceInMinutes(appDate, now);
            return diffMinutes > 0 && diffMinutes <= 30;
          });

          if (imminentApp && imminentApp.id !== upcomingReminder?.id) {
            setUpcomingReminder(imminentApp);
            if ('Notification' in window && Notification.permission === 'granted') {
               new Notification("预约提醒", { 
                 body: `您预约的理发服务将在 ${imminentApp.timeSlot} 开始，请及时到店。`,
                 icon: '/favicon.ico' 
               });
            }
          }
      }
    };

    const timer = setInterval(runChecks, 30000);
    return () => clearInterval(timer);
  }, [settings, currentUser]); 

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const [apps, barberList] = await Promise.all([
        StorageService.getAppointments(),
        StorageService.getBarbers()
      ]);
      apps.sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot));
      setAppointments(apps);
      setBarbers(barberList);

      const newQrUrls = { ...qrUrls };
      const relevantApps = currentUser ? apps.filter(a => a.userId === currentUser.id) : [];
      for (const app of relevantApps) {
        if (app.status === AppointmentStatus.BOOKED && !newQrUrls[app.id]) {
          try {
            newQrUrls[app.id] = await QRCode.toDataURL(app.id);
          } catch (err) {}
        }
      }
      setQrUrls(newQrUrls);
    } catch (e) {
      console.error("Failed to refresh data", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoginSuccess = () => {
      const user = StorageService.getCurrentUser();
      setCurrentUser(user);
      setView('HOME');
  };

  const handleUserUpdate = () => {
      const user = StorageService.getCurrentUser();
      setCurrentUser(user);
  };

  const handleLogout = () => {
      StorageService.logout();
      setCurrentUser(null);
      setView('LOGIN');
  };

  const navigateTo = (target: ViewState) => {
      if (target === 'ADMIN') {
          if (!currentUser) { setView('LOGIN'); return; }
          if (currentUser.role !== 'ADMIN') { alert("无权限"); return; }
      }
      if ((target === 'BOOKING' || target === 'MY_APPOINTMENTS' || target === 'PROFILE') && !currentUser) {
          setView('LOGIN'); return;
      }
      setPreSelectedBarberId(null);
      setView(target);
  };

  const handleScanSuccess = async (scannedApp: Appointment) => {
    const currentApps = await StorageService.getAppointments();
    const app = currentApps.find(a => a.id === scannedApp.id) || scannedApp;

    if (app.status !== AppointmentStatus.BOOKED) {
      setScanResult({ app, success: false, message: `该预约状态为 ${getStatusText(app.status)}，无法签到。` }); 
      return;
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (app.date === todayStr) {
        const unfinishedPriorApps = currentApps.filter(a => 
            a.barberId === app.barberId && a.date === app.date && a.status === AppointmentStatus.BOOKED && a.timeSlot < app.timeSlot
        );
        if (unfinishedPriorApps.length > 0) {
            setScanResult({ app, success: false, message: `前方还有 ${unfinishedPriorApps.length} 位预约顾客未完成，请排队。` }); 
            return;
        }
    }

    const success = await StorageService.updateAppointmentStatus(app.id, AppointmentStatus.COMPLETED);
    if (success) {
      setScanResult({ app, success: true, message: `签到成功！${app.timeSlot} 服务开始。` });
      refreshData();
    } else {
       setScanResult({ app, success: false, message: "系统更新失败。" }); 
    }
    setView('HOME');
  };

  const handleScanBooking = (barberId: string) => {
    setPreSelectedBarberId(barberId);
    setView('BOOKING');
  };

  const handleCancelAppointment = async (id: string) => {
    if (confirm('确定要取消预约吗？')) {
      setLoading(true);
      await StorageService.updateAppointmentStatus(id, AppointmentStatus.CANCELLED);
      await refreshData();
      setLoading(false);
      if (upcomingReminder?.id === id) setUpcomingReminder(null);
    }
  };

  const activeAppointments = appointments.filter(a => a.status === AppointmentStatus.BOOKED && a.userId === currentUser?.id);

  const getStatusText = (status: AppointmentStatus) => {
     switch(status) {
         case AppointmentStatus.BOOKED: return '已预约';
         case AppointmentStatus.COMPLETED: return '已完成';
         case AppointmentStatus.CANCELLED: return '已取消';
         case AppointmentStatus.EXPIRED: return '已过期';
         default: return status;
     }
  };

  // --- Components ---

  const TodayQueueDashboard = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return (
        <div className="mt-6">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-3">
                <Clock size={18} className="text-brand-600" />
                今日动态
            </h2>
            <div className="flex flex-nowrap overflow-x-auto gap-4 pb-2 -mx-4 px-4 scrollbar-hide">
                {barbers.map(barber => {
                    const dailyApps = appointments
                        .filter(a => a.barberId === barber.id && a.date === todayStr && a.status !== AppointmentStatus.CANCELLED && a.status !== AppointmentStatus.EXPIRED)
                        .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
                    const nextUpIndex = dailyApps.findIndex(a => a.status === AppointmentStatus.BOOKED);

                    return (
                        <div key={barber.id} className="flex-shrink-0 w-64 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-3 border-b border-gray-50 pb-2">
                                <img src={barber.avatarUrl} alt={barber.name} className="w-10 h-10 rounded-full object-cover" />
                                <div className="min-w-0">
                                    <h3 className="font-bold text-gray-800 truncate">{barber.name}</h3>
                                    <p className="text-xs text-gray-500">排队: {dailyApps.length} 人</p>
                                </div>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                {dailyApps.length === 0 ? <span className="text-xs text-gray-400">暂无预约</span> : 
                                    dailyApps.map((app, index) => {
                                        const isCompleted = app.status === AppointmentStatus.COMPLETED;
                                        const isNext = index === nextUpIndex;
                                        return (
                                            <div key={app.id} className={`flex-shrink-0 w-14 h-14 flex flex-col items-center justify-center rounded-lg border text-[10px] ${
                                                isCompleted ? 'bg-green-50 border-green-200 text-green-700' : 
                                                isNext ? 'bg-brand-600 border-brand-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-400'
                                            }`}>
                                                <span className="font-bold text-xs">{app.timeSlot}</span>
                                                <span className="truncate w-full text-center px-1">{app.customerName}</span>
                                            </div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  const MobileHeader = () => {
    let title = "BarberBook";
    if (view === 'BOOKING') title = "立即预约";
    if (view === 'PROFILE') title = "个人中心";
    if (view === 'AI_ADVISOR') title = "AI 顾问";
    if (view === 'ADMIN') title = "管理后台";

    return (
        <div className="bg-white/80 backdrop-blur-md sticky top-0 z-20 pt-safe border-b border-gray-200 transition-all">
            <div className="h-12 px-4 flex items-center justify-between">
                {view === 'HOME' ? (
                   <div className="flex items-center gap-2 text-brand-600">
                     <Scissors className="transform -scale-x-100" size={20} />
                     <span className="text-lg font-bold tracking-tight">BarberBook</span>
                   </div>
                ) : (
                   <h1 className="text-lg font-bold text-gray-900 absolute left-1/2 transform -translate-x-1/2">{title}</h1>
                )}
                
                {/* Right Action */}
                <div className="flex items-center gap-3">
                   {view === 'HOME' && (
                       <button onClick={() => setView('SCANNER')} className="p-2 bg-gray-100 rounded-full text-gray-700">
                           <QrCode size={18} />
                       </button>
                   )}
                   {view !== 'HOME' && view !== 'LOGIN' && (
                       <button onClick={() => setView('HOME')} className="text-sm font-medium text-brand-600">
                           完成
                       </button>
                   )}
                </div>
            </div>
        </div>
    );
  };

  const BottomTab = () => {
      // Hide bottom tab on Login, Scanner, or deep Booking flow
      if (view === 'LOGIN' || view === 'SCANNER') return null;

      const items = [
          { id: 'HOME', label: '首页', icon: Home },
          { id: 'BOOKING', label: '预约', icon: PlusCircle },
          { id: 'AI_ADVISOR', label: '顾问', icon: Sparkles },
          { id: 'PROFILE', label: currentUser ? '我的' : '登录', icon: currentUser?.role === 'ADMIN' ? Settings : UserIcon, target: currentUser?.role === 'ADMIN' ? 'ADMIN' : 'PROFILE' }
      ];

      return (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-30">
              <div className="h-14 flex items-center justify-around">
                  {items.map(item => {
                      const isActive = view === item.id || (item.target && view === item.target);
                      return (
                          <button 
                            key={item.id}
                            onClick={() => navigateTo((item.target || item.id) as ViewState)}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 ${isActive ? 'text-brand-600' : 'text-gray-400'}`}
                          >
                              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                              <span className="text-[10px] font-medium">{item.label}</span>
                          </button>
                      );
                  })}
              </div>
          </div>
      );
  };

  if (authLoading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
              <Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-4" />
              <p className="text-sm text-gray-500">正在同步数据...</p>
          </div>
      );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
      {/* Dynamic Header */}
      {view !== 'SCANNER' && <MobileHeader />}

      {/* Main Scrollable Content */}
      <main className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide ${view !== 'SCANNER' && view !== 'LOGIN' ? 'pb-20' : ''}`}>
        
        {/* Banner for Reminders */}
        {upcomingReminder && view === 'HOME' && (
           <div className="mx-4 mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-3 shadow-sm">
              <div className="bg-amber-100 p-1.5 rounded-full text-amber-600 mt-0.5">
                <Bell size={16} className="animate-swing origin-top" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-gray-900">预约即将开始</h4>
                <p className="text-xs text-gray-600 mt-0.5">
                   {upcomingReminder.timeSlot} 的服务将在30分钟内开始。
                </p>
              </div>
              <button onClick={() => setUpcomingReminder(null)} className="text-gray-400 p-1"><X size={16} /></button>
           </div>
        )}

        {/* Scan Result Modal */}
        {scanResult && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                scanResult.success ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
              }`}>
                {scanResult.success ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{scanResult.success ? '签到成功' : '操作受阻'}</h3>
              <p className="text-gray-500 mb-6 text-sm leading-relaxed">{scanResult.message}</p>
              <button 
                onClick={() => setScanResult(null)}
                className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold active:scale-95 transition-transform"
              >
                我知道了
              </button>
            </div>
          </div>
        )}

        {/* Views */}
        <div className="p-4 md:max-w-xl md:mx-auto min-h-full">
            {view === 'LOGIN' && <Auth onLoginSuccess={handleLoginSuccess} />}

            {view === 'PROFILE' && currentUser && (
                <UserProfile 
                    currentUser={currentUser}
                    appointments={appointments}
                    barbers={barbers}
                    onLogout={handleLogout}
                    onUserUpdate={handleUserUpdate}
                />
            )}

            {view === 'HOME' && (
              <div className="space-y-6">
                {/* Greeting */}
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                            {currentUser ? `Hi, ${currentUser.name}` : '欢迎光临'}
                        </h2>
                        <p className="text-sm text-gray-500">今天想换个什么造型？</p>
                    </div>
                    {currentUser?.avatarUrl && (
                        <img src={currentUser.avatarUrl} className="w-10 h-10 rounded-full border border-gray-100" />
                    )}
                </div>

                {/* Quick Actions Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div onClick={() => navigateTo('BOOKING')} className="bg-brand-600 p-4 rounded-2xl text-white shadow-lg shadow-brand-200 active:scale-95 transition-transform">
                    <PlusCircle size={28} className="mb-8 opacity-90" />
                    <h3 className="font-bold">立即预约</h3>
                    <p className="text-brand-100 text-xs mt-1">无需排队</p>
                  </div>
                  <div onClick={() => setView('AI_ADVISOR')} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-transform">
                    <Sparkles size={28} className="mb-8 text-indigo-500" />
                    <h3 className="font-bold text-gray-900">AI 顾问</h3>
                    <p className="text-gray-400 text-xs mt-1">发型建议</p>
                  </div>
                </div>

                {!loading && <TodayQueueDashboard />}
                
                {!loading && barbers.length > 0 && (
                  <div className="mt-4">
                      <ScheduleDashboard 
                        appointments={appointments} 
                        barbers={barbers} 
                        onRefresh={refreshData}
                        isRefreshing={isRefreshing}
                      />
                  </div>
                )}

                {/* My Upcoming Appointments Card (Mobile Style) */}
                {currentUser && activeAppointments.length > 0 && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-gray-800">我的预约</h2>
                            <span className="text-xs text-brand-600 font-bold bg-brand-50 px-2 py-1 rounded-full">{activeAppointments.length}</span>
                        </div>
                        <div className="space-y-3">
                            {activeAppointments.map(app => (
                                <div key={app.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex flex-col items-center justify-center text-gray-600">
                                            <span className="text-xs font-bold">{app.date.slice(5)}</span>
                                            <span className="text-sm font-bold text-gray-900">{app.timeSlot}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{barbers.find(b => b.id === app.barberId)?.name}</h3>
                                            <p className="text-xs text-gray-400">ID: {app.id.slice(0, 4)}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleCancelAppointment(app.id)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-500"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
              </div>
            )}

            {view === 'BOOKING' && (
              <BookingFlow 
                currentUser={currentUser}
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

            {view === 'ADMIN' && currentUser?.role === 'ADMIN' && (
               <AdminPanel />
            )}
            
            {view === 'AI_ADVISOR' && <AIAdvisor />}
        </div>
      </main>

      <BottomTab />
    </div>
  );
}

export default App;
