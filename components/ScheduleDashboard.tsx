
import React, { useEffect, useState, useMemo } from 'react';
import { Appointment, AppointmentStatus, Barber, SystemSettings } from '../types';
import { StorageService } from '../services/storageService';
import { DEFAULT_SETTINGS } from '../constants';
import { format, addDays, isSameDay } from 'date-fns';
import { CalendarDays, User, Clock, RefreshCw } from 'lucide-react';

interface ScheduleDashboardProps {
  appointments: Appointment[];
  barbers: Barber[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export const ScheduleDashboard: React.FC<ScheduleDashboardProps> = ({ appointments, barbers, onRefresh, isRefreshing = false }) => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    StorageService.getSettings().then(setSettings);
  }, []);

  // Generate next 7 days
  const next7Days = useMemo(() => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(today, i));
    }
    return dates;
  }, []);

  // Calculate daily capacity based on open/close time and slot duration
  const dailyTimeSlotsCount = useMemo(() => {
    const [startH, startM] = settings.openingTime.split(':').map(Number);
    const [endH, endM] = settings.closingTime.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    
    const totalMinutes = endMinutes - startMinutes;
    return Math.floor(totalMinutes / settings.slotDurationMinutes);
  }, [settings]);

  // Actual capacity is min(time slots, configured max people)
  const maxDailyCapacity = Math.min(dailyTimeSlotsCount, settings.maxSlotsPerBarberPerDay);

  const getBookedCount = (barberId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return appointments.filter(a => 
      a.barberId === barberId && 
      a.date === dateStr && 
      a.status !== AppointmentStatus.CANCELLED &&
      a.status !== AppointmentStatus.EXPIRED 
    ).length;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <CalendarDays size={20} className="text-brand-600" />
          本周预约看板
        </h3>
        <div className="flex items-center gap-4">
            {/* Legend for status colors */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> 空闲</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> 繁忙</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 opacity-60"></span> 已满</div>
            </div>
            {onRefresh && (
                <button 
                    onClick={onRefresh} 
                    disabled={isRefreshing}
                    className={`p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                    title="刷新数据"
                >
                    <RefreshCw size={16} />
                </button>
            )}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left min-w-[120px] bg-white sticky left-0 z-10 border-b border-r border-gray-100 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)]">
                <span className="text-gray-400 font-normal">理发师 / 日期</span>
              </th>
              {next7Days.map(date => (
                <th key={date.toISOString()} className="p-3 font-medium text-gray-600 min-w-[80px] border-b border-gray-100 bg-white">
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-gray-400 uppercase mb-1">{WEEKDAYS[date.getDay()]}</span>
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full ${isSameDay(date, new Date()) ? 'bg-brand-600 text-white font-bold' : ''}`}>
                      {format(date, 'd')}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {barbers.map(barber => (
              <tr key={barber.id} className="hover:bg-gray-50 transition-colors group">
                {/* Sticky Barber Column */}
                <td className="p-3 bg-white sticky left-0 z-10 border-r border-gray-100 group-hover:bg-gray-50 shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-3">
                    <img src={barber.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-200 border border-gray-100" />
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 truncate max-w-[100px]">{barber.name.split(' ')[0]}</div>
                      <div className="text-[10px] text-gray-500 truncate max-w-[100px]">{barber.specialty}</div>
                    </div>
                  </div>
                </td>

                {/* Date Cells */}
                {next7Days.map(date => {
                  const booked = getBookedCount(barber.id, date);
                  const isFull = booked >= maxDailyCapacity;
                  const isBusy = booked >= maxDailyCapacity * 0.7; // > 70% capacity
                  
                  // Style logic
                  let colorClass = "bg-green-50 text-green-700 border-green-100";
                  if (isFull) {
                      colorClass = "bg-red-50 text-red-700 border-red-100 opacity-60";
                  } else if (isBusy) {
                      colorClass = "bg-yellow-50 text-yellow-700 border-yellow-100";
                  }

                  return (
                    <td key={date.toISOString()} className="p-2 border-b border-gray-50 text-center">
                      <div className={`rounded-lg p-2 border ${colorClass} flex flex-col items-center justify-center gap-1 transition-all`}>
                        <span className="text-xs font-bold">{booked}/{maxDailyCapacity}</span>
                        <div className="w-full h-1.5 bg-white/50 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isFull ? 'bg-red-500' : isBusy ? 'bg-yellow-500' : 'bg-green-500'}`} 
                            style={{ width: `${Math.min(100, (booked / maxDailyCapacity) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
