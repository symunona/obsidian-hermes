
import React, { useRef, useEffect, useMemo } from 'react';
import { LogEntry, UsageMetadata } from '../types';

interface KernelLogProps {
  isVisible: boolean;
  logs: LogEntry[];
  usage?: UsageMetadata;
  onFlush: () => void;
  fileCount: number;
}

const KernelLog: React.FC<KernelLogProps> = ({ isVisible, logs, usage, onFlush, fileCount }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // @ts-ignore
  const isObsidian = typeof app !== 'undefined' && app.vault !== undefined;

  useEffect(() => {
    if (logContainerRef.current && isVisible) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isVisible]);

  const contextLimit = 1000000; // 1M tokens for Gemini Flash context
  const totalTokens = usage?.totalTokenCount || 0;
  const promptTokens = usage?.promptTokenCount || 0;
  const contextPercentage = useMemo(() => Math.min(100, (totalTokens / contextLimit) * 100), [totalTokens]);

  return (
    <div className={`hermes-border-t hermes-border-white/5 hermes-bg-[#080c14]/95 hermes-flex hermes-flex-col hermes-transition-all hermes-duration-300 hermes-ease-in-out hermes-shrink-0 hermes-relative ${isVisible ? 'hermes-h-64' : 'hermes-h-0 hermes-opacity-0 hermes-overflow-hidden'}`}>
      <div className="hermes-px-8 hermes-py-2.5 hermes-border-b hermes-border-white/5 hermes-flex hermes-justify-between hermes-items-center hermes-bg-slate-900/60 hermes-sticky hermes-top-0 hermes-backdrop-blur-sm hermes-z-10">
        <div className="flex items-center space-x-4">
          <h2 className="hermes-text-[8px] hermes-font-black hermes-uppercase hermes-tracking-[0.2em] hermes-text-slate-500">System Kernel Log</h2>
          <div className="hermes-flex hermes-items-center hermes-space-x-4 hermes-border-l hermes-border-white/10 hermes-pl-4">
            <div className="flex items-center space-x-2">
              <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Vault:</span>
              <span className="text-[9px] font-mono text-slate-300">{fileCount} MD</span>
            </div>
          </div>
        </div>
        <button 
          onClick={onFlush} 
          className="text-[8px] text-slate-500 hover:text-red-400 transition-colors uppercase font-black tracking-widest"
        >
          Flush Log
        </button>
      </div>
      
      <div ref={logContainerRef} className="flex-grow overflow-y-auto p-4 space-y-1 font-mono text-[10px] leading-relaxed relative pb-12">
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

      {/* Context Size Indicator (Bottom Left) */}
      <div className="absolute bottom-10 left-8 z-20 pointer-events-none">
        <div className="bg-slate-900/90 border border-white/10 px-3 py-2 rounded-lg backdrop-blur-md shadow-2xl flex flex-col space-y-1 min-w-[120px]">
          <div className="flex justify-between items-center">
            <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Context Window</span>
            <span className="text-[8px] font-mono text-slate-400">{contextPercentage.toFixed(1)}%</span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 transition-all duration-1000" 
              style={{ width: `${contextPercentage}%` }}
            />
          </div>
          <div className="flex flex-col text-[7px] font-mono text-slate-500 leading-tight">
            <div className="flex justify-between">
              <span>PROMPT:</span>
              <span className="text-slate-300">{promptTokens.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>TOTAL:</span>
              <span className="text-indigo-300">{totalTokens.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-1.5 border-t border-white/5 bg-black/40 flex justify-between items-center text-xs text-slate-600 shrink-0">
        <div className="flex items-center space-x-4">
          <span>Environment: <span className={isObsidian ? 'text-green-500' : 'text-yellow-500'}>{isObsidian ? 'Obsidian' : 'Standalone'}</span></span>
          <span>Buffer: <span className="text-slate-400">{logs.length} entries</span></span>
        </div>
        <div className="text-slate-700">Hermes v1.1.0</div>
      </div>
    </div>
  );
};

export default KernelLog;
