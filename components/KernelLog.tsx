
import React, { useRef, useEffect } from 'react';
import { LogEntry } from '../types';

interface KernelLogProps {
  isVisible: boolean;
  logs: LogEntry[];
  totalTokens?: number;
  onFlush: () => void;
}

const KernelLog: React.FC<KernelLogProps> = ({ isVisible, logs, totalTokens = 0, onFlush }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // @ts-ignore
  const isObsidian = typeof app !== 'undefined' && app.vault !== undefined;

  useEffect(() => {
    if (logContainerRef.current && isVisible) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isVisible]);

  return (
    <div className={`border-t border-white/5 bg-[#080c14]/95 flex flex-col transition-all duration-300 ease-in-out shrink-0 ${isVisible ? 'h-56' : 'h-0 opacity-0 overflow-hidden'}`}>
      <div className="px-8 py-2.5 border-b border-white/5 flex justify-between items-center bg-slate-900/60 sticky top-0 backdrop-blur-sm z-10">
        <div className="flex items-center space-x-4">
          <h2 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">System Kernel Log</h2>
          <div className="flex items-center space-x-2 border-l border-white/10 pl-4">
            <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Usage:</span>
            <span className="text-[9px] font-mono text-slate-300">{totalTokens.toLocaleString()} tokens</span>
          </div>
        </div>
        <button 
          onClick={onFlush} 
          className="text-[8px] text-slate-500 hover:text-red-400 transition-colors uppercase font-black tracking-widest"
        >
          Flush Log
        </button>
      </div>
      
      <div ref={logContainerRef} className="flex-grow overflow-y-auto p-4 space-y-1 font-mono text-[10px] leading-relaxed relative">
        {logs.length === 0 ? (
          <div className="text-slate-800 italic py-2 px-4">Waiting for system signals...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex space-x-3 group px-4 hover:bg-white/[0.02]">
              <span className="text-slate-700 shrink-0 select-none">[{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
              <div className="flex flex-col">
                <span className={`${
                  log.type === 'action' ? 'text-indigo-400' : 
                  log.type === 'error' ? 'text-red-400' : 
                  'text-slate-500'
                }`}>
                  {log.message}
                </span>
                {log.duration !== undefined && (
                  <span className="text-[8px] text-slate-700 uppercase font-bold tracking-tight mt-0.5">
                    Process completed in {log.duration}ms
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-8 py-1.5 border-t border-white/5 bg-black/40 flex justify-between items-center text-[8px] font-black uppercase tracking-[0.2em] text-slate-600">
        <div className="flex items-center space-x-4">
          <span>Environment: <span className={isObsidian ? 'text-emerald-500' : 'text-amber-500'}>{isObsidian ? 'Obsidian' : 'Standalone'}</span></span>
          <span>Buffer: <span className="text-slate-400">{logs.length} entries</span></span>
        </div>
        <div className="text-slate-700">Hermes OS v1.1.0-Core</div>
      </div>
    </div>
  );
};

export default KernelLog;
