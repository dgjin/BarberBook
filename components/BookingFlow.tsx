import React, { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import { Barber, Appointment, AppointmentStatus, SystemSettings } from '../types';
import { StorageService } from '../services/storageService';
import { MOCK_USER_ID, MOCK_USER_NAME, DEFAULT_SETTINGS } from '../constants';
import { Calendar, Clock, Check, CheckCircle, User, AlertCircle, Loader2, Phone, Sun, Moon, Sunrise, Sunset, Coffee, Download } from 'lucide-react';
import { format, addDays, isSameDay } from 'date-fns';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 配置中国法定节假日列表 (YYYY-MM-DD)
// 注意：在实际生产环境中，这通常由后端 API 动态提供，因为每年的调休安排不同。
const HOLIDAYS: string[] = [
  // 2024年
  '2024-01-01', // 元旦
  '2024-02-10', '2024-02-11', '2024-02-12', '2024-02-13', '2024-02-14', '2024-02-15', '2024-02-16', '2024-02-17', // 春节
  '2024-04-04', '2024-04-05', '2024-04-06', // 清明节
  '2024-05-01', '2024-05-02', '2024-05-03', '2024-05-04', '2024-05-05', // 劳动节
  '2024-06-08', '2024-06-09', '2024-06-10', // 端午节
  '2024-09-15', '2024-09-16', '2024-09-17', // 中秋节
  '2024-10-01', '2024-10-02', '2024-10-03', '2024-10-04', '2024-10-05', '2024-10-06', '2024-10-07', // 国庆节
  
  // 2025年
  '2025-01-01', // 元旦
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31', '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04', // 春节
  '2025-04-04', '2025-04-05', '2025-04-06', // 清明
  '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05', // 劳动节
  '2025-05-31', '2025-06-01', '2025-06-02', // 端午节
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05', '2025-10-06', '2025-10-07', // 国庆节

  // 2026年 (预估)
  '2026-01-01', // 元旦
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', // 春节 (2月17日为除夕/初一附近)
  '2026-04-04', '2026-04-05', '2026-04-06', // 清明节
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', // 劳动节
  '2026-06-19', '2026-06-20', '2026-06-21', // 端午节
  '2026-09-25', '2026-09-26', '2026-09-27', // 中秋节
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', // 国庆节

  // 2027年 (预估-年初)
  '2027-01-01', // 元旦
  '2027-02-05', '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-02-10', '2027-02-11', // 春节 (2月6日为除夕/初一附近)
];

interface BookingFlowProps {
  onComplete: () => void;
  onCancel: () => void;
  preSelectedBarberId?: string | null;
}

export const BookingFlow: React.FC<BookingFlowProps> = ({ onComplete, onCancel, preSelectedBarberId }) => {
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

  // New fields for user input
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Success state
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
        
        // Handle pre-selection
        if (preSelectedBarberId) {
            const preBarber = b.find(barber => barber.id === preSelectedBarberId);
            if (preBarber) {
                setSelectedBarber(preBarber);
                setStep(2); // Jump to date selection
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

  // Generate available dates (Today + 6 days)
  const availableDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(today, i));
    }
    return dates;
  }, []);

  // Check if a date is a non-working day (Weekend or Holiday)
  const isNonWorkingDay = (date: Date) => {
    const day = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // 0 is Sunday, 6 is Saturday
    if (day === 0 || day === 6) return true;
    
    // Check specific holidays
    if (HOLIDAYS.includes(dateStr)) return true;
    
    return false;
  };

  // Generate time slots
  const timeSlots = useMemo(() => {
    if (loading) return [];
    const slots = [];
    let currentTime = settings.openingTime;
    const [endHour, endMinute] = settings.closingTime.split(':').map(Number);
    
    while (true) {
      const [h, m] = currentTime.split(':').map(Number);
      if (h > endHour || (h === endHour && m >= endMinute)) break;
      
      slots.push(currentTime);
      
      // Add duration
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
      a.status !== AppointmentStatus.CANCELLED
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
      a.status !== AppointmentStatus.CANCELLED
    );
  };

  const handleBook = async () => {
    if (!selectedBarber || !selectedDate || !selectedTime) return;

    // Validation
    if (!customerName.trim()) {
      setError("请输入您的姓名。");
      return;
    }
    if (!customerPhone.trim()) {
      setError("请输入您的联系电话。");
      return;
    }

    setSubmitting(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Double check non-working day
    if (isNonWorkingDay(selectedDate)) {
        setError("所选日期为休息日，无法预约。");
        setSubmitting(false);
        return;
    }

    // Check constraints again with latest state
    const dailyCount = getDailyCount(selectedBarber.id, dateStr);
    if (dailyCount >= settings.maxSlotsPerBarberPerDay) {
      setError("该理发师在所选日期的预约已满。");
      setSubmitting(false);
      return;
    }

    if (isSlotTaken(selectedTime)) {
      setError("该时间段已被预约。");
      setSubmitting(false);
      return;
    }

    const newAppointment: Appointment = {
      id: crypto.randomUUID(),
      barberId: selectedBarber.id,
      userId: MOCK_USER_ID,
      userName: MOCK_USER_NAME,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      date: dateStr,
      timeSlot: selectedTime,
      status: AppointmentStatus.BOOKED,
      timestamp: Date.now()
    };

    await StorageService.addAppointment(newAppointment);

    // Generate QR Code for the success screen
    try {
        const url = await QRCode.toDataURL(newAppointment.id, { width: 400, margin: 2 });
        setQrUrl(url);
    } catch (err) {
        console.error("QR Generation failed", err);
    }

    setSubmitting(false);
    setStep(4); // Move to success step
  };

  const TimeSlotButton = ({ time }: { time: string }) => {
    const taken = isSlotTaken(time);
    
    const isPast = useMemo(() => {
        if (!selectedDate) return false;
        const now = new Date();
        // Check if selected date is same as today (YYYY-MM-DD match)
        if (isSameDay(selectedDate, now)) {
            const [h, m] = time.split(':').map(Number);
            const currentH = now.getHours();
            const currentM = now.getMinutes();
            // Strictly check if the slot is in the past
            if (h < currentH || (h === currentH && m < currentM)) return true;
        }
        return false;
    }, [time]);

    const disabled = taken || isPast;

    return (
      <button
        disabled={disabled}
        onClick={() => { setSelectedTime(time); setError(null); }}
        className={`py-2 px-1 rounded-lg text-sm font-medium border transition-colors ${
          selectedTime === time
            ? 'bg-brand-600 text-white border-brand-600'
            : disabled
              ? 'bg-gray-50 text-gray-300 border-transparent cursor-not-allowed line-through decoration-gray-300'
              : 'bg-white text-gray-700 border-gray-200 hover:border-brand-300'
        }`}
      >
        {time}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Loader2 size={32} className="animate-spin mb-2 text-brand-600" />
        <p>正在加载预约数据...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Progress */}
      {step < 4 && (
        <div className="flex items-center justify-between mb-8">
            {[1, 2, 3].map((s) => (
            <div key={s} className={`flex items-center ${s < 3 ? 'flex-1' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                {s}
                </div>
                {s < 3 && <div className={`h-1 flex-1 mx-2 ${step > s ? 'bg-brand-600' : 'bg-gray-200'}`} />}
            </div>
            ))}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Step 1: Select Barber */}
      {(step === 1) && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800">选择理发师</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {barbers.map(barber => (
              <div 
                key={barber.id}
                onClick={() => { setSelectedBarber(barber); setError(null); }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedBarber?.id === barber.id 
                    ? 'border-brand-600 bg-brand-50 shadow-md' 
                    : 'border-gray-200 hover:border-brand-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  <img src={barber.avatarUrl} alt={barber.name} className="w-16 h-16 rounded-full object-cover bg-gray-200" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{barber.name}</h3>
                    <p className="text-sm text-gray-500">{barber.specialty}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-6">
            <button
              disabled={!selectedBarber}
              onClick={() => setStep(2)}
              className="px-6 py-2 bg-brand-600 text-white rounded-lg disabled:opacity-50 hover:bg-brand-700 font-medium"
            >
              下一步：选择日期
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Date & Time */}
      {step === 2 && selectedBarber && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">选择日期</h2>
            {/* If auto-selected, show who was selected */}
            {preSelectedBarberId && (
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    <User size={14} />
                    <span>预约: {selectedBarber.name}</span>
                </div>
            )}
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {availableDates.map(date => {
                const isFull = isDateFull(date, selectedBarber.id);
                const isRestDay = isNonWorkingDay(date);
                const isSelected = selectedDate && isSameDay(selectedDate, date);
                const isDisabled = isFull || isRestDay;

                return (
                  <button
                    key={date.toISOString()}
                    disabled={isDisabled}
                    onClick={() => { setSelectedDate(date); setSelectedTime(null); setError(null); }}
                    className={`flex-shrink-0 w-20 h-24 rounded-lg flex flex-col items-center justify-center border-2 transition-all ${
                      isSelected
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : isDisabled
                          ? 'border-gray-50 bg-gray-50 text-gray-300 cursor-not-allowed opacity-80'
                          : 'border-gray-200 bg-white hover:border-brand-300 text-gray-700'
                    }`}
                  >
                    <span className="text-xs font-medium uppercase">{WEEKDAYS[date.getDay()]}</span>
                    <span className="text-xl font-bold">{format(date, 'd')}</span>
                    {isRestDay ? (
                        <span className="text-[10px] mt-1 font-bold text-gray-400">休息</span>
                    ) : (
                        isFull && <span className="text-[10px] mt-1 text-red-400">已满</span>
                    )}
                  </button>
                );
              })}
            </div>

          {selectedDate && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold text-gray-800 mb-4">选择时间</h2>
              
              {/* Morning Slots */}
              {morningSlots.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-500">
                    <Sunrise size={16} className="text-orange-400" />
                    上午
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {morningSlots.map(time => <TimeSlotButton key={time} time={time} />)}
                  </div>
                </div>
              )}

              {/* Afternoon Slots */}
              {afternoonSlots.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-500">
                    <Sun size={16} className="text-brand-500" />
                    下午
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {afternoonSlots.map(time => <TimeSlotButton key={time} time={time} />)}
                  </div>
                </div>
              )}

              {timeSlots.length === 0 && (
                <div className="text-center text-gray-400 py-4">今日无可用时间段。</div>
              )}
            </div>
          )}

          <div className="flex justify-between mt-8 pt-4 border-t">
            <button 
                onClick={() => {
                    if (preSelectedBarberId) {
                        onCancel(); // If auto-selected, back means exit
                    } else {
                        setStep(1);
                    }
                }} 
                className="text-gray-500 hover:text-gray-800"
            >
                返回
            </button>
            <button
              disabled={!selectedTime}
              onClick={() => setStep(3)}
              className="px-6 py-2 bg-brand-600 text-white rounded-lg disabled:opacity-50 hover:bg-brand-700 font-medium"
            >
              下一步：填写信息
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && selectedBarber && selectedDate && selectedTime && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">完善预约信息</h2>
          
          <div className="space-y-4 mb-6">
             <div className="p-4 bg-gray-50 rounded-xl space-y-3">
               <div className="flex items-center justify-between text-sm">
                 <span className="text-gray-500">理发师</span>
                 <span className="font-semibold text-gray-900">{selectedBarber.name}</span>
               </div>
               <div className="flex items-center justify-between text-sm">
                 <span className="text-gray-500">日期</span>
                 <span className="font-semibold text-gray-900">{format(selectedDate, 'yyyy年MM月dd日')}</span>
               </div>
               <div className="flex items-center justify-between text-sm">
                 <span className="text-gray-500">时间</span>
                 <span className="font-semibold text-gray-900">{selectedTime}</span>
               </div>
             </div>

             <div className="space-y-4 pt-2">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">预约人姓名 <span className="text-red-500">*</span></label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <User size={18} className="text-gray-400" />
                   </div>
                   <input 
                     type="text" 
                     value={customerName}
                     onChange={(e) => setCustomerName(e.target.value)}
                     placeholder="请输入您的姓名"
                     className="pl-10 block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-brand-500 focus:border-brand-500"
                   />
                 </div>
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">联系电话（座机/手机） <span className="text-red-500">*</span></label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <Phone size={18} className="text-gray-400" />
                   </div>
                   <input 
                     type="tel" 
                     value={customerPhone}
                     onChange={(e) => setCustomerPhone(e.target.value)}
                     placeholder="请输入联系电话"
                     className="pl-10 block w-full border border-gray-300 rounded-lg p-2.5 focus:ring-brand-500 focus:border-brand-500"
                   />
                 </div>
               </div>
             </div>
          </div>

          <div className="flex gap-4 pt-4 border-t">
            <button 
              disabled={submitting}
              onClick={() => setStep(2)} 
              className="flex-1 py-3 text-gray-600 bg-gray-100 rounded-lg font-medium hover:bg-gray-200"
            >
              修改
            </button>
            <button 
              disabled={submitting}
              onClick={handleBook}
              className="flex-1 py-3 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
              {submitting ? '提交预约' : '确认预约'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success & QR Code */}
      {step === 4 && selectedBarber && selectedDate && selectedTime && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={40} strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">预约成功！</h2>
              <p className="text-gray-500 mb-8">您的预约已确认，请准时到达。</p>

              <div className="bg-gray-50 p-6 rounded-2xl mb-8 border border-gray-100">
                  <div className="flex flex-col items-center gap-4 mb-6">
                      {qrUrl ? (
                          <>
                            <img src={qrUrl} alt="Booking QR" className="w-48 h-48 mix-blend-multiply" />
                            <a 
                                href={qrUrl} 
                                download={`booking-${format(selectedDate, 'yyyyMMdd')}-${selectedTime.replace(':','')}.png`}
                                className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium bg-brand-50 px-3 py-1.5 rounded-full transition-colors"
                            >
                                <Download size={16} />
                                保存图片
                            </a>
                          </>
                      ) : (
                          <div className="w-48 h-48 bg-gray-200 animate-pulse rounded" />
                      )}
                      <p className="text-xs text-gray-400">请在到店时出示此二维码签到</p>
                  </div>
                  
                  <div className="space-y-3 text-sm border-t border-gray-200 pt-4">
                      <div className="flex justify-between">
                          <span className="text-gray-500">理发师</span>
                          <span className="font-bold text-gray-900">{selectedBarber.name}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-gray-500">时间</span>
                          <span className="font-bold text-gray-900">{format(selectedDate, 'yyyy-MM-dd')} {selectedTime}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-gray-500">预约人</span>
                          <span className="font-bold text-gray-900">{customerName}</span>
                      </div>
                  </div>
              </div>

              <button 
                  onClick={onComplete}
                  className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-black transition-colors"
              >
                  完成
              </button>
          </div>
      )}
    </div>
  );
};