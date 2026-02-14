
import React, { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import { Barber, Appointment, AppointmentStatus, SystemSettings, User } from '../types';
import { StorageService } from '../services/storageService';
import { DEFAULT_SETTINGS } from '../constants';
import { Check, CheckCircle, User as UserIcon, AlertCircle, Loader2, Phone, Sun, Sunrise, Download } from 'lucide-react';
import { format, addDays, isSameDay } from 'date-fns';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 配置中国法定节假日列表 (YYYY-MM-DD)
const HOLIDAYS: string[] = [
  '2024-05-01', '2024-05-02', '2024-05-03', '2024-05-04', '2024-05-05',
  '2024-06-08', '2024-06-09', '2024-06-10',
  '2024-09-15', '2024-09-16', '2024-09-17',
  '2024-10-01', '2024-10-02', '2024-10-03', '2024-10-04', '2024-10-05', '2024-10-06', '2024-10-07',
];

interface BookingFlowProps {
  onComplete: () => void;
  onCancel: () => void;
  preSelectedBarberId?: string | null;
  currentUser: User | null;
}

export const BookingFlow: React.FC<BookingFlowProps> = ({ onComplete, onCancel, preSelectedBarberId, currentUser }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState(currentUser?.name || '');
  const [customerPhone, setCustomerPhone] = useState(currentUser?.phone || '');
  
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [s, b, a] = await Promise.all([
          StorageService.getSettings(),
          StorageService.getBarbers(),
          StorageService.getAppointments()
        ]);
        setSettings(s);
        setBarbers(b);
        setAppointments(a);
        
        if (preSelectedBarberId) {
            const preBarber = b.find(barber => barber.id === preSelectedBarberId);
            if (preBarber) {
                setSelectedBarber(preBarber);
                setStep(2);
            } else {
                setError("未找到指定的理发师，请手动选择。");
            }
        }
      } catch (e) {
        setError("加载数据失败，请重试。");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [preSelectedBarberId]);

  useEffect(() => {
      if (currentUser) {
          if (!customerName) setCustomerName(currentUser.name);
          if (!customerPhone) setCustomerPhone(currentUser.phone);
      }
  }, [currentUser]);

  const availableDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(today, i));
    }
    return dates;
  }, []);

  const isNonWorkingDay = (date: Date) => {
    const day = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');
    if (day === 0 || day === 6) return true;
    if (HOLIDAYS.includes(dateStr)) return true;
    return false;
  };

  const timeSlots = useMemo(() => {
    if (loading) return [];
    const slots = [];
    let currentTime = settings.openingTime;
    const [endHour, endMinute] = settings.closingTime.split(':').map(Number);
    
    while (true) {
      const [h, m] = currentTime.split(':').map(Number);
      if (h > endHour || (h === endHour && m >= endMinute)) break;
      slots.push(currentTime);
      let newMin = m + settings.slotDurationMinutes;
      let newHour = h + Math.floor(newMin / 60);
      newMin = newMin % 60;
      currentTime = `${String(newHour).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`;
    }
    return slots;
  }, [settings, loading]);

  const morningSlots = timeSlots.filter(t => parseInt(t.split(':')[0]) < 12);
  const afternoonSlots = timeSlots.filter(t => parseInt(t.split(':')[0]) >= 12);

  const getDailyCount = (barberId: string, dateStr: string) => {
    return appointments.filter(a => 
      a.barberId === barberId && 
      a.date === dateStr && 
      a.status !== AppointmentStatus.CANCELLED &&
      a.status !== AppointmentStatus.EXPIRED
    ).length;
  };

  const isDateFull = (date: Date, barberId: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return getDailyCount(barberId, dateStr) >= settings.maxSlotsPerBarberPerDay;
  };

  const isSlotTaken = (time: string) => {
    if (!selectedBarber || !selectedDate) return false;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return appointments.some(a => 
      a.barberId === selectedBarber.id && 
      a.date === dateStr && 
      a.timeSlot === time &&
      a.status !== AppointmentStatus.CANCELLED &&
      a.status !== AppointmentStatus.EXPIRED
    );
  };

  const renderTimeSlotBtn = (time: string) => {
    const taken = isSlotTaken(time);
    let isPast = false;
    if (selectedDate) {
        const now = new Date();
        if (isSameDay(selectedDate, now)) {
            const [h, m] = time.split(':').map(Number);
            const currentH = now.getHours();
            const currentM = now.getMinutes();
            if (h < currentH || (h === currentH && m < currentM)) isPast = true;
        }
    }
    const disabled = taken || isPast;

    return (
      <button
        key={time}
        disabled={disabled}
        onClick={() => { setSelectedTime(time); setError(null); }}
        className={`py-3 px-1 rounded-xl text-sm font-medium border transition-all active:scale-95 ${
          selectedTime === time
            ? 'bg-brand-600 text-white border-brand-600 shadow-md transform scale-105'
            : disabled
              ? 'bg-gray-50 text-gray-300 border-transparent cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-200'
        }`}
      >
        {time}
      </button>
    );
  };

  const handleBook = async () => {
    if (!selectedBarber || !selectedDate || !selectedTime) return;
    if (!currentUser) { setError("请先登录"); return; }
    if (!customerName.trim() || !customerPhone.trim()) { setError("请完善信息"); return; }

    setSubmitting(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    if (isNonWorkingDay(selectedDate)) { setError("休息日无法预约"); setSubmitting(false); return; }
    if (getDailyCount(selectedBarber.id, dateStr) >= settings.maxSlotsPerBarberPerDay) { setError("预约已满"); setSubmitting(false); return; }
    if (isSlotTaken(selectedTime)) { setError("已被预约"); setSubmitting(false); return; }

    const newAppointment: Appointment = {
      id: crypto.randomUUID(),
      barberId: selectedBarber.id,
      userId: currentUser.id,
      userName: currentUser.username,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      date: dateStr,
      timeSlot: selectedTime,
      status: AppointmentStatus.BOOKED,
      timestamp: Date.now()
    };

    await StorageService.addAppointment(newAppointment);

    try {
        const url = await QRCode.toDataURL(newAppointment.id, { width: 400, margin: 2 });
        setQrUrl(url);
    } catch (err) { console.error(err); }

    setSubmitting(false);
    setStep(4); 
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand-600" /></div>;

  return (
    <div className="pb-32">
      {/* Step Indicator */}
      {step < 4 && (
        <div className="flex gap-2 mb-6 px-2">
            {[1, 2, 3].map((s) => (
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= s ? 'bg-brand-600' : 'bg-gray-200'}`} />
            ))}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm border border-red-100 animate-in slide-in-from-top-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Step 1: Select Barber */}
      {(step === 1) && (
        <div className="space-y-4 animate-in slide-in-from-right-8 fade-in duration-300">
          <h2 className="text-xl font-bold text-gray-900">选择理发师</h2>
          <div className="space-y-3">
            {barbers.map(barber => (
              <div 
                key={barber.id}
                onClick={() => { setSelectedBarber(barber); setError(null); }}
                className={`p-4 rounded-2xl border transition-all active:scale-[0.98] flex items-center gap-4 ${
                  selectedBarber?.id === barber.id 
                    ? 'border-brand-600 bg-brand-50 shadow-sm ring-1 ring-brand-600' 
                    : 'border-gray-200 bg-white'
                }`}
              >
                <img src={barber.avatarUrl} alt={barber.name} className="w-14 h-14 rounded-full object-cover bg-gray-100" />
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{barber.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{barber.specialty}</p>
                </div>
                {selectedBarber?.id === barber.id && <CheckCircle className="text-brand-600" size={20} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Date & Time */}
      {step === 2 && selectedBarber && (
        <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-300">
          {/* Horizontal Date Picker */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">选择日期</h2>
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory">
                {availableDates.map(date => {
                  const isFull = isDateFull(date, selectedBarber.id);
                  const isRestDay = isNonWorkingDay(date);
                  const isSelected = selectedDate && isSameDay(selectedDate, date);
                  return (
                    <button
                      key={date.toISOString()}
                      disabled={isFull || isRestDay}
                      onClick={() => { setSelectedDate(date); setSelectedTime(null); setError(null); }}
                      className={`snap-center flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center border transition-all ${
                        isSelected
                          ? 'border-brand-600 bg-brand-600 text-white shadow-lg shadow-brand-200 scale-105'
                          : 'border-gray-200 bg-white text-gray-700'
                      } ${(isFull || isRestDay) ? 'opacity-50 grayscale' : ''}`}
                    >
                      <span className="text-[10px] mb-1">{WEEKDAYS[date.getDay()]}</span>
                      <span className="text-xl font-bold">{format(date, 'd')}</span>
                      {(isFull || isRestDay) && <span className="text-[10px] mt-1">{isRestDay ? '休' : '满'}</span>}
                    </button>
                  );
                })}
            </div>
          </div>

          {selectedDate && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-lg font-bold text-gray-900 mb-3">选择时间</h2>
              <div className="space-y-4">
                {morningSlots.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-gray-400 uppercase">
                      <Sunrise size={14} /> 上午
                    </div>
                    <div className="grid grid-cols-4 gap-2">{morningSlots.map(renderTimeSlotBtn)}</div>
                  </div>
                )}
                {afternoonSlots.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-gray-400 uppercase">
                      <Sun size={14} /> 下午
                    </div>
                    <div className="grid grid-cols-4 gap-2">{afternoonSlots.map(renderTimeSlotBtn)}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Info */}
      {step === 3 && (
        <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-300">
           <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
               <img src={selectedBarber?.avatarUrl} className="w-12 h-12 rounded-full bg-white" />
               <div className="flex-1">
                   <div className="font-bold text-gray-900">{selectedBarber?.name}</div>
                   <div className="text-sm text-gray-500">
                       {selectedDate && format(selectedDate, 'MM月dd日')} · {selectedTime}
                   </div>
               </div>
           </div>

           <div className="space-y-4">
               <div>
                 <label className="text-sm font-medium text-gray-700 ml-1">姓名</label>
                 <div className="mt-1 relative">
                   <UserIcon className="absolute left-3 top-3.5 text-gray-400" size={18} />
                   <input 
                     value={customerName}
                     onChange={(e) => setCustomerName(e.target.value)}
                     className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                     placeholder="预约姓名"
                   />
                 </div>
               </div>
               <div>
                 <label className="text-sm font-medium text-gray-700 ml-1">电话</label>
                 <div className="mt-1 relative">
                   <Phone className="absolute left-3 top-3.5 text-gray-400" size={18} />
                   <input 
                     type="tel"
                     value={customerPhone}
                     onChange={(e) => setCustomerPhone(e.target.value)}
                     className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                     placeholder="联系方式"
                   />
                 </div>
               </div>
           </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && selectedBarber && (
          <div className="text-center animate-in zoom-in duration-300 pt-8">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={40} strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">预约成功</h2>
              <p className="text-gray-500 text-sm mb-8">请截图保存二维码，到店出示</p>

              <div className="bg-white p-6 rounded-3xl shadow-lg shadow-gray-100 border border-gray-100 mx-auto max-w-xs relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-400 to-indigo-500" />
                  <img src={qrUrl} className="w-48 h-48 mx-auto mix-blend-multiply" />
                  <div className="mt-4 pt-4 border-t border-gray-100 text-left space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-400">理发师</span><span className="font-bold">{selectedBarber.name}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">时间</span><span className="font-bold">{selectedDate && format(selectedDate, 'MM-dd')} {selectedTime}</span></div>
                  </div>
              </div>
          </div>
      )}

      {/* Fixed Bottom Action Bar */}
      {step < 4 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-30 pb-safe">
              <div className="flex gap-3 max-w-xl mx-auto">
                  {step > 1 && (
                      <button 
                        onClick={() => setStep(s => s - 1 as any)}
                        className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold active:scale-95 transition-transform"
                      >
                          上一步
                      </button>
                  )}
                  <button 
                    disabled={
                        (step === 1 && !selectedBarber) || 
                        (step === 2 && (!selectedDate || !selectedTime)) ||
                        (step === 3 && submitting)
                    }
                    onClick={() => step === 3 ? handleBook() : setStep(s => s + 1 as any)}
                    className="flex-[2] py-3.5 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-200 disabled:opacity-50 disabled:shadow-none active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                      {step === 3 ? (submitting ? <Loader2 className="animate-spin" /> : '确认预约') : '下一步'}
                  </button>
              </div>
          </div>
      )}
      
      {step === 4 && (
           <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-30 pb-safe">
              <button 
                  onClick={onComplete}
                  className="w-full max-w-xl mx-auto py-3.5 bg-gray-900 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
              >
                  完成
              </button>
           </div>
      )}
    </div>
  );
};
