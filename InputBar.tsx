
import React from 'react';
import { ConnectionStatus } from './types';

interface InputBarProps {
  inputText: string;
  setInputText: (t: string) => void;
  onSendText: (e: React.FormEvent) => void;
  isListening: boolean;
  onStartSession: () => void;
  onStopSession: () => void;
  status: ConnectionStatus;
  onOpenSettings: () => void;
  showLogs: boolean;
  onToggleLogs: () => void;
}

const InputBar: React.FC<InputBarProps> = ({
  inputText,
  setInputText,
  onSendText,
  isListening,
  onStartSession,
  onStopSession,
  status,
  onOpenSettings,
  showLogs,
  onToggleLogs
}) => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-[80px] px-8 bg-slate-900/90 backdrop-blur-2xl border-t border-white/5 flex items-center justify-center z-[50]">
      <div className="flex items-center space-x-4 w-full max-w-6xl">
        {/* Action Group */}
        <div className="flex items-center space-x-2 shrink-0">
          <button 
            onClick={onOpenSettings}
            className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-white/5 text-slate-400 hover:text-white"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <button 
            onClick={onToggleLogs}
            className={`p-3 rounded-xl transition-all border ${showLogs ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-800 border-white/5 text-slate-400 hover:text-white hover:bg-slate-700'}`}
            title="Toggle Debug Log"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>

        {/* Text Input Form */}
        <form onSubmit={onSendText} className="flex-grow flex items-center space-x-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-2.5 group focus-within:border-indigo-500/50 transition-all shadow-inner">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message Haiku..." 
            className="flex-grow bg-transparent border-none outline-none text-sm text-slate-200 placeholder:text-slate-600"
          />
          <button type="submit" className="p-1 text-slate-500 hover:text-indigo-400 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </form>

        {/* Talking Face Icon (Right) */}
        <div className="shrink-0">
          {isListening ? (
            <button 
              onClick={onStopSession} 
              className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95"
              title="Stop Listening"
            >
              <span className="flex relative">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z" />
                  <path className="animate-pulse" d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5 5 2.24 5 5zm-2 0c0-1.66-1.34-3-3-3s-3 1.34-3 3 1.34 3 3 3 3-1.34 3-3z" />
                </svg>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              </span>
            </button>
          ) : (
            <button 
              onClick={onStartSession}
              disabled={status === ConnectionStatus.CONNECTING}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg transition-all disabled:opacity-50 border border-indigo-400/20 active:scale-95 group"
              title="Start Voice Session"
            >
              <svg className="w-6 h-6 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
                <path d="M12 14c-4.42 0-8 2-8 5v1h16v-1c0-3-3.58-5-8-5z" />
                <path className="opacity-40" d="M19 8c1.33 1.33 1.33 3.67 0 5" />
                <path className="opacity-70" d="M21 6c2 2 2 6 0 8" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};

export default InputBar;
