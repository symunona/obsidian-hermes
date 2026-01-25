
import React from 'react';
import { ConnectionStatus } from '../types';

interface HeaderProps {
  status: ConnectionStatus;
  showLogs: boolean;
  onToggleLogs: () => void;
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ status, showLogs, onToggleLogs, onOpenSettings }) => {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-slate-900/60 backdrop-blur-xl shrink-0 z-50">
      <div className="flex items-center space-x-6">
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tighter bg-gradient-to-br from-indigo-400 to-emerald-400 bg-clip-text text-transparent uppercase">Hermes</h1>
          <div className="flex items-center space-x-2">
            <div className={`w-1.5 h-1.5 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-emerald-500' : status === ConnectionStatus.CONNECTING ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{status}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-1">
        <button 
          onClick={onToggleLogs} 
          className={`p-2 transition-all ${showLogs ? 'text-indigo-400' : 'text-slate-500 hover:text-white'}`}
          title="Toggle System Log"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        
        <button 
          onClick={onOpenSettings} 
          className="p-2 text-slate-500 hover:text-white transition-all"
          title="System Settings"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
