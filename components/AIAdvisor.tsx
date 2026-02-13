import React, { useState } from 'react';
import { GeminiService } from '../services/geminiService';
import { Sparkles, Send, User } from 'lucide-react';

export const AIAdvisor: React.FC = () => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse(null);

    const result = await GeminiService.askStyleAdvice(query);
    setResponse(result);
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded-xl shadow-sm border border-gray-100 min-h-[400px] flex flex-col">
      <div className="flex items-center gap-2 mb-6 border-b pb-4">
        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
          <Sparkles size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">AI 发型顾问</h2>
          <p className="text-xs text-gray-500">由 Gemini 2.5 驱动</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {!response && !loading && (
          <div className="text-center text-gray-400 py-10">
            <p>描述您的发质、脸型或期望的风格。</p>
            <p className="text-sm mt-2">例如：“我是圆脸，有点自然卷，适合什么短发？”</p>
          </div>
        )}

        {query && response && (
          <div className="flex gap-3 justify-end">
             <div className="bg-brand-50 text-brand-900 p-3 rounded-2xl rounded-tr-sm max-w-[80%]">
               <p className="text-sm">{query}</p>
             </div>
             <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
               <User size={14} className="text-gray-500" />
             </div>
          </div>
        )}

        {loading && (
          <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
               <Sparkles size={14} className="text-indigo-600 animate-pulse" />
             </div>
             <div className="bg-gray-50 p-3 rounded-2xl rounded-tl-sm">
               <div className="flex gap-1">
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
               </div>
             </div>
          </div>
        )}

        {response && (
           <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
               <Sparkles size={14} className="text-indigo-600" />
             </div>
             <div className="bg-indigo-50 text-gray-800 p-4 rounded-2xl rounded-tl-sm max-w-[90%] shadow-sm">
               <p className="whitespace-pre-wrap text-sm leading-relaxed">{response}</p>
             </div>
          </div>
        )}
      </div>

      <form onSubmit={handleAsk} className="relative mt-auto">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="询问发型建议..."
          className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
        />
        <button 
          type="submit" 
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1.5 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};