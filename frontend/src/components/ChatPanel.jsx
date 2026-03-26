// src/components/ChatPanel.jsx
'use client';
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Download, Loader2, Minus, Send, X } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ChatPanel({
  setHighlightIds,
  isCollapsed = false,
  onClose,
  onMinimize,
  onRestore,
}) {
  const [messages, setMessages] = useState([
    { role: 'ai', content: "Hello! I am the O2C Graph AI. Ask me anything about Sales Orders, Customers, Deliveries, or Invoices.", sql: null }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    await processMessage(input.trim());
    setInput('');
  };

  const processMessage = async (userMsg) => {
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/query`, { query: userMsg });
      const { answer, sql, highlight_ids } = res.data;
      
      setMessages(prev => [...prev, { role: 'ai', content: answer, sql }]);
      // Fulfill the Highlighting UI requirement
      if (highlight_ids && highlight_ids.length > 0) {
        setHighlightIds(highlight_ids);
      } else {
        setHighlightIds([]);
      }
    } catch (error) {
       console.error(error);
       setMessages(prev => [...prev, { role: 'ai', content: 'Connection Error to Cognitive Backend.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const jsonBlob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(jsonBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `o2c_chat_export_${new Date().getTime()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e293b] text-slate-100 flex-1 border-l border-slate-700/50 shadow-2xl">
      <div className="px-5 py-3 bg-[#0f172a] border-b border-slate-800 shadow-md shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="bg-gradient-to-r from-blue-400 via-teal-400 to-emerald-400 text-transparent bg-clip-text drop-shadow-sm tracking-wide font-bold text-[17px]">
              Analyst Copilot
            </div>
            <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Natural language to O2C SQL
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <button
                onClick={onRestore}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-all border border-slate-700 flex items-center shadow-sm"
                title="Restore Copilot"
              >
                <Minus className="h-4 w-4 rotate-180" />
              </button>
            ) : (
              <button
                onClick={onMinimize}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-all border border-slate-700 flex items-center shadow-sm"
                title="Minimize Copilot"
              >
                <Minus className="h-4 w-4" />
              </button>
            )}
            <button 
               onClick={handleExport}
               className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-all border border-slate-700 flex items-center shadow-sm"
               title="Export Chat to JSON"
            >
               <Download className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-slate-800 hover:bg-red-500/20 p-2 rounded-lg transition-all border border-slate-700 hover:border-red-500/40 flex items-center shadow-sm"
              title="Close Copilot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth" ref={scrollRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm ${msg.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-blue-900/20' : 'bg-slate-800 border border-slate-700/50'}`}>
              <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-a:text-blue-400 max-w-none text-[15px]">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              
              {msg.sql && (
                <details className="mt-4 text-xs bg-[#0b1120] rounded-lg p-3 border border-slate-700/50 cursor-pointer overflow-hidden transition-all group">
                  <summary className="text-slate-400 hover:text-white select-none transition-colors font-medium outline-none">View Source SQL</summary>
                  <pre className="mt-3 text-emerald-400 overflow-x-auto whitespace-pre-wrap font-mono leading-snug">{msg.sql}</pre>
                </details>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start animate-in fade-in zoom-in-95">
            <div className="bg-slate-800 p-4 rounded-2xl flex items-center space-x-3 border border-slate-700/50 shadow-sm">
              <Loader2 className="animate-spin h-5 w-5 text-blue-400" />
              <span className="text-[15px] font-medium text-slate-300">Translating to SQL...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-[#0f172a] border-t border-slate-800 flex flex-col space-y-3">
        {/* Suggested Queries */}
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide">
          {["Show overdue invoices", "Which customers have open deliveries?", "Trace Sales Order Flow"].map((q, i) => (
             <button 
                key={i}
                onClick={() => { setInput(''); processMessage(q); }}
                disabled={loading}
                className="whitespace-nowrap px-3 py-1.5 text-xs font-medium bg-slate-800 text-blue-400 hover:bg-slate-700 hover:text-white border border-blue-900/30 rounded-full transition-colors disabled:opacity-50"
             >
                {q}
             </button>
          ))}
        </div>
        
        <form onSubmit={handleSend} className="flex space-x-3 bg-slate-800 p-1.5 rounded-xl border border-slate-700 shadow-inner">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent px-4 py-2 text-[15px] focus:outline-none text-white placeholder-slate-400"
            placeholder="Ask a question about your SAP Order-to-Cash data..."
          />
          <button 
            type="submit" 
            disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:grayscale text-white p-2.5 rounded-lg transition-all flex items-center justify-center min-w-[48px] shadow-sm transform active:scale-95"
          >
           <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
