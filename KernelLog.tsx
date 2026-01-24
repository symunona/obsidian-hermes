
import React, { useRef, useEffect } from 'react';
import { LogEntry } from './types';

interface KernelLogProps {
  isVisible: boolean;
  logs: LogEntry[];
  onFlush: () => void;
}

const KernelLog: React.FC<KernelLogProps> = ({ isVisible, logs, onFlush }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current && isVisible) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isVisible]);

  return (
    <div className={`border-t border-white/5 bg-[#080c14]/80 flex flex-col transition-all duration-300 ease-in-out shrink-0 ${isVisible ? 'h-32' : 'h-0 opacity-0 overflow-hidden'}`}>
      <div className="px-8 py-2 border-b border-white/5 flex justify-between items-center bg-slate-900/40 sticky top-0">
        <h2 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600">Kernel Log</h2>
        <button 
          onClick={onFlush} 
          className="text-[8px] text-slate-700 hover:text-indigo-400 transition-colors uppercase font-bold"
        >
          Flush
        </button>
      </div>
      <div ref={logContainerRef} className="flex-grow overflow-y-auto p-4 space-y-1 font-mono text-[9px] text-slate-500">
        {logs.map((log) => (
          <div key={log.id} className="flex space-x-2">
            <span className="text-slate-800 shrink-0">[{log.timestamp.toLocaleTimeString([], { hour12: false })}]</span>
            <span className={`${log.type === 'action' ? 'text-indigo-500' : log.type === 'error' ? 'text-red-500' : 'text-slate-600'}`}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KernelLog;
