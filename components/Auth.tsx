
import React, { useState, useEffect } from 'react';
import { User, Lock, Phone, ArrowRight, Loader2, UserPlus, LogIn, MessageCircle, X, Settings, Database, Link as LinkIcon, Check, Lock as LockIcon, Fingerprint } from 'lucide-react';
import { StorageService } from '../services/storageService';

interface AuthProps {
  onLoginSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Config State (DB & WeChat)
  const [showConfig, setShowConfig] = useState(false);
  const [dbConfig, setDbConfig] = useState({ url: '', key: '' });
  const [wechatAppId, setWechatAppId] = useState('');
  const [isEnvConfigured, setIsEnvConfigured] = useState(false);

  useEffect(() => {
     setIsEnvConfigured(StorageService.isUsingEnv());
     const config = StorageService.getConnectionConfig();
     setDbConfig({ url: config.url || '', key: config.key || '' });
     
     // Load saved WeChat AppID
     const savedAppId = localStorage.getItem('barber_app_wechat_appid') || '';
     setWechatAppId(savedAppId);
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    try {
        if (!isEnvConfigured) {
            StorageService.updateConnection(dbConfig.url, dbConfig.key);
        }
        // Save WeChat AppID
        if (wechatAppId.trim()) {
            localStorage.setItem('barber_app_wechat_appid', wechatAppId.trim());
        } else {
            localStorage.removeItem('barber_app_wechat_appid');
        }

        setShowConfig(false);
        setSuccessMsg("系统配置已更新");
        setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
        setError("配置格式无效");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await StorageService.login(username, password);
      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.message || '登录失败');
      }
    } catch (e) {
      setError('系统错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!username || !password || !name || !phone) {
        setError("所有字段都必须填写");
        setLoading(false);
        return;
    }

    try {
      const result = await StorageService.register({
        username,
        password,
        name,
        phone,
        role: 'USER', // Default role
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
      });

      if (result.success) {
        setSuccessMsg("注册成功！正在登录...");
        setTimeout(() => {
            onLoginSuccess();
        }, 1000);
      } else {
        setError(result.message || '注册失败');
      }
    } catch (e) {
      setError('注册过程中发生错误');
    } finally {
      setLoading(false);
    }
  };

  const handleWeChatRedirect = () => {
    if (!wechatAppId) {
        setError("请先在右上角设置中配置微信 AppID");
        setShowConfig(true);
        return;
    }

    // 构建真实微信登录 URL (Web QR Code Login)
    // 文档: https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
    const redirectUri = encodeURIComponent(window.location.origin);
    const state = crypto.randomUUID(); // CSRF protection
    
    // 存储 state 以便回调验证 (可选)
    localStorage.setItem('wechat_auth_state', state);

    const wechatUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${wechatAppId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;

    // 跳转
    setLoading(true);
    setSuccessMsg("正在跳转至微信安全登录...");
    setTimeout(() => {
        window.location.href = wechatUrl;
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 min-h-[60vh] relative">
      
      {/* Config Button */}
      <button 
        onClick={() => setShowConfig(true)}
        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-brand-600 transition-colors bg-white rounded-full shadow-sm border border-gray-100"
        title="系统配置"
      >
        <Settings size={20} />
      </button>

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
              <button onClick={() => setShowConfig(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
              
              <div className="flex items-center gap-2 mb-6 text-brand-700">
                <Settings size={24} />
                <h3 className="text-xl font-bold">系统连接配置</h3>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-6">
                   {/* Database Config */}
                   <div className="space-y-3">
                       <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                           <Database size={14} /> 数据库 (Supabase)
                       </h4>
                       {isEnvConfigured ? (
                            <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs text-gray-600 flex items-center gap-2">
                                <LockIcon size={14} className="text-green-600 flex-shrink-0" />
                                <span>环境变量已生效，连接被锁定。</span>
                            </div>
                       ) : (
                           <>
                               <div className="relative">
                                    <input 
                                        type="text" 
                                        value={dbConfig.url}
                                        onChange={(e) => setDbConfig({...dbConfig, url: e.target.value})}
                                        placeholder="Project URL (https://xyz.supabase.co)"
                                        className="block w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                    />
                               </div>
                               <div className="relative">
                                    <input 
                                        type="password" 
                                        value={dbConfig.key}
                                        onChange={(e) => setDbConfig({...dbConfig, key: e.target.value})}
                                        placeholder="Anon Public Key"
                                        className="block w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500"
                                    />
                               </div>
                           </>
                       )}
                   </div>

                   {/* WeChat Config */}
                   <div className="space-y-3">
                       <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                           <MessageCircle size={14} /> 微信开放平台
                       </h4>
                       <div className="relative">
                            <Fingerprint size={16} className="absolute left-3 top-2.5 text-gray-400" />
                            <input 
                                type="text" 
                                value={wechatAppId}
                                onChange={(e) => setWechatAppId(e.target.value)}
                                placeholder="AppID (例如: wx08a4a...)"
                                className="pl-9 block w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-brand-500 focus:border-brand-500 font-mono"
                            />
                       </div>
                       <p className="text-[10px] text-gray-400 leading-tight">
                           配置有效的 AppID 后，点击微信登录将跳转至官方二维码页。请确保本地域名已在微信后台配置回调。
                       </p>
                   </div>

                   <div className="pt-2">
                       <button type="submit" className="w-full bg-brand-600 text-white py-2.5 rounded-xl font-bold hover:bg-brand-700 flex items-center justify-center gap-2">
                           <Check size={18} /> 保存配置
                       </button>
                   </div>
              </form>
           </div>
        </div>
      )}

      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100 relative">
        
        {/* Header / Tabs */}
        <div className="flex justify-center mb-6">
            <div className="bg-gray-100 p-1 rounded-xl flex w-full">
                <button 
                    onClick={() => { setMode('LOGIN'); setError(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'LOGIN' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <LogIn size={16} /> 登录
                </button>
                <button 
                    onClick={() => { setMode('REGISTER'); setError(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'REGISTER' ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <UserPlus size={16} /> 注册
                </button>
            </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold text-gray-900">
            {mode === 'LOGIN' ? '欢迎回来' : '创建新账号'}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {mode === 'LOGIN' ? '请使用您的账号登录 BarberBook Pro' : '注册即刻享受智能预约服务'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm text-center border border-red-100 animate-in slide-in-from-top-2">
            {error}
          </div>
        )}
        
        {successMsg && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm text-center border border-green-100 animate-in slide-in-from-top-2">
            {successMsg}
          </div>
        )}

        <form className="mt-4 space-y-4" onSubmit={mode === 'LOGIN' ? handleLogin : handleRegister}>
          
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10 block w-full border border-gray-300 rounded-xl p-3 focus:ring-brand-500 focus:border-brand-500 bg-gray-50 focus:bg-white"
                placeholder="请输入用户名"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 block w-full border border-gray-300 rounded-xl p-3 focus:ring-brand-500 focus:border-brand-500 bg-gray-50 focus:bg-white"
                placeholder="请输入密码"
              />
            </div>
          </div>

          {/* Register Fields */}
          {mode === 'REGISTER' && (
              <div className="space-y-4 animate-in slide-in-from-top-4 fade-in">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">真实姓名</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full border border-gray-300 rounded-xl p-3 focus:ring-brand-500 focus:border-brand-500 bg-gray-50 focus:bg-white"
                        placeholder="预约时显示"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Phone className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="pl-10 block w-full border border-gray-300 rounded-xl p-3 focus:ring-brand-500 focus:border-brand-500 bg-gray-50 focus:bg-white"
                            placeholder="用于接收通知"
                        />
                    </div>
                </div>
              </div>
          )}

          <div className="pt-4">
            <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-200 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-70 transition-all active:scale-95"
            >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                    <span className="flex items-center gap-2">
                        {mode === 'LOGIN' ? '登录' : '立即注册'} <ArrowRight size={16} />
                    </span>
                )}
            </button>
          </div>
        </form>
        
        {/* Third Party Login */}
        <div className="mt-8">
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">或者使用</span>
                </div>
            </div>

            <div className="mt-6 flex justify-center">
                <button 
                    onClick={handleWeChatRedirect}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center bg-white group-hover:bg-[#07C160] group-hover:border-[#07C160] transition-all shadow-sm">
                        <MessageCircle className="text-[#07C160] group-hover:text-white transition-colors" size={24} />
                    </div>
                    <span className="text-xs text-gray-500">微信</span>
                </button>
            </div>
        </div>

        {mode === 'LOGIN' && (
             <div className="text-center mt-6 text-xs text-gray-400">
                测试管理员账号: admin / admin123
             </div>
        )}
      </div>
    </div>
  );
};
