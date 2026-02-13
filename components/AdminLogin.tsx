import React, { useState, useEffect } from 'react';
import { Smartphone, Lock, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onCancel: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onCancel }) => {
  const [step, setStep] = useState<'PHONE' | 'CODE'>('PHONE');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: number;
    if (countdown > 0) {
      timer = window.setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入有效的手机号码');
      return;
    }

    setLoading(true);
    setError(null);

    // Mock API call delay
    setTimeout(() => {
      const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(mockCode);
      setLoading(false);
      setStep('CODE');
      setCountdown(60);
      
      // In a real app, this would be sent via SMS API.
      // For demo purposes, we alert it.
      alert(`【BarberBook】您的验证码是：${mockCode}。如非本人操作，请忽略本短信。`);
    }, 1000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    setLoading(true);
    setError(null);

    // Mock verification delay
    setTimeout(() => {
      if (code === generatedCode || code === '888888') { // Backdoor for demo: 888888 always works
        onLoginSuccess();
      } else {
        setLoading(false);
        setError('验证码错误，请重试');
      }
    }, 800);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-brand-50 rounded-full flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-brand-600" />
          </div>
          <h2 className="mt-6 text-2xl font-extrabold text-gray-900">
            管理员登录
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            为了系统安全，请验证您的手机号码
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        {step === 'PHONE' ? (
          <form className="mt-8 space-y-6" onSubmit={handleSendCode}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">手机号码</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Smartphone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    className="appearance-none rounded-lg relative block w-full px-3 py-3 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-brand-500 focus:border-brand-500 focus:z-10 sm:text-sm"
                    placeholder="请输入手机号"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={onCancel}
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
              >
                返回
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-70"
              >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : '获取验证码'}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleVerify}>
             <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    maxLength={6}
                    required
                    className="appearance-none rounded-lg relative block w-full px-3 py-3 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-brand-500 focus:border-brand-500 focus:z-10 sm:text-sm tracking-widest"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={countdown > 0}
                    onClick={handleSendCode}
                    className="absolute right-2 top-2 bottom-2 px-3 text-xs font-medium text-brand-600 hover:bg-brand-50 rounded disabled:text-gray-400 disabled:hover:bg-transparent"
                  >
                    {countdown > 0 ? `${countdown}s 后重发` : '重新发送'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 text-right">验证码已发送至 {phone}</p>
              </div>

              <div className="flex gap-4">
               <button
                  type="button"
                  onClick={() => { setStep('PHONE'); setError(null); }}
                  className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  上一步
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-70"
                >
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <span className="flex items-center gap-2">登录 <ArrowRight size={16} /></span>}
                </button>
              </div>
          </form>
        )}
      </div>
    </div>
  );
};