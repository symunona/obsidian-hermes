
import React from 'react';
import { ConnectionStatus } from '../types';
import SettingsButton from './SettingsButton';

interface HeaderProps {
  status: ConnectionStatus;
  showLogs: boolean;
  onToggleLogs: () => void;
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ status, showLogs, onToggleLogs, onOpenSettings }) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800 shrink-0 z-50">
      <div className="flex items-center space-x-6">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold">Hermes</h1>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500' : status === ConnectionStatus.CONNECTING ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-xs text-slate-500">{status}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-1">
        <button 
          onClick={onToggleLogs} 
          className={`p-2 transition-all ${showLogs ? 'text-blue-500' : 'text-slate-500 hover:text-white'}`}
          title="Toggle System Log"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        
        <SettingsButton onOpenSettings={onOpenSettings} />
      </div>
    </header>
  );
};

export default Header;
