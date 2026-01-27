
import React, { useRef, useEffect, useMemo } from 'react';
import { LogEntry, UsageMetadata } from '../types';
import { isObsidian } from '../utils/environment';

interface KernelLogProps {
  isVisible: boolean;
  logs: LogEntry[];
  usage?: UsageMetadata;
  onFlush: () => void;
  fileCount: number;
}

const KernelLog: React.FC<KernelLogProps> = ({ isVisible, logs, usage, onFlush, fileCount }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  const isObsidianEnvironment = isObsidian();

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
    <div className={`flex-1 flex flex-col hermes-bg-secondary/95 transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0 z-50'}`}>
      <div className="px-8 py-2.5 border-b border/10 flex justify-between items-center bg-secondary-alt/60 sticky top-0 backdrop-blur-sm z-10">
        <div className="flex items-center space-x-4">
          <h2 className="text-[8px] font-black uppercase tracking-[0.2em] text-muted">System Kernel Log</h2>
          <div className="flex items-center space-x-4 border-l border/20 pl-4">
            <div className="flex items-center space-x-2">
              <span className="text-[8px] font-bold text-accent uppercase tracking-widest">Vault:</span>
              <span className="text-[9px] font-mono text-normal">{fileCount} MD</span>
            </div>
          </div>
        </div>
        <button 
          onClick={onFlush} 
          className="text-[8px] text-muted hover:text-error transition-colors uppercase font-black tracking-widest"
        >
          Flush Log
        </button>
      </div>
      
      {/* Context Size Indicator (Top of logs) */}
      <div className="mx-4 mt-4 mb-2">
        <div className="bg-secondary-alt/60 border border/10 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-[8px] font-black text-accent uppercase tracking-widest">Context Window</span>
            <div className="w-24 h-1.5 bg-secondary/50 border border/10 rounded-full overflow-hidden">
              <div 
                className="h-full interactive-bg transition-all duration-1000" 
                style={{ width: `${contextPercentage}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-muted">{contextPercentage.toFixed(1)}%</span>
          </div>
          <div className="flex items-center space-x-6 text-[8px] font-mono text-faint">
            <div className="flex items-center space-x-2">
              <span className="uppercase tracking-wide">Prompt:</span>
              <span className="text-normal">{promptTokens.toLocaleString()}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="uppercase tracking-wide">Total:</span>
              <span className="text-accent font-bold">{totalTokens.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div ref={logContainerRef} className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[10px] leading-relaxed">
        {logs.length === 0 ? (
          <div className="text-faint italic py-2 px-4">Waiting for system signals...</div>
        ) : (
          <>
            {logs.slice(-100).map((log) => (
              <div key={log.id} className="flex space-x-3 group px-4 hover:bg-secondary/5">
                <span className="text-faint shrink-0">[{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                <div className="flex flex-col">
                  <span 
                    className={`${
                      log.type === 'action' ? 'text-accent' : 
                      log.type === 'error' ? 'hermes-error font-bold' : 
                      'text-muted'
                    }`}
                    style={log.type === 'error' ? { color: 'var(--hermes-error, #ef4444)' } : undefined}
                  >
                    {log.message}
                  </span>
                  {log.type === 'error' && log.errorDetails && (
                    <div className="mt-1 space-y-1">
                      {log.errorDetails.toolName && (
                        <span className="text-[8px] font-mono" style={{ color: 'var(--hermes-error, #ef4444)' }}>
                          Tool: {log.errorDetails.toolName}
                        </span>
                      )}
                      {log.errorDetails.apiCall && (
                        <span className="text-[8px] font-mono block" style={{ color: 'var(--hermes-error, #ef4444)' }}>
                          API: {log.errorDetails.apiCall}
                        </span>
                      )}
                      {(log.errorDetails.contentSize !== undefined || log.errorDetails.requestSize !== undefined || log.errorDetails.responseSize !== undefined) && (
                        <div className="text-[8px] font-mono space-x-2" style={{ color: 'var(--hermes-error, #ef4444)' }}>
                          {log.errorDetails.contentSize !== undefined && (
                            <span>Content: {log.errorDetails.contentSize.toLocaleString()} bytes</span>
                          )}
                          {log.errorDetails.requestSize !== undefined && (
                            <span>Request: {log.errorDetails.requestSize.toLocaleString()} bytes</span>
                          )}
                          {log.errorDetails.responseSize !== undefined && (
                            <span>Response: {log.errorDetails.responseSize.toLocaleString()} bytes</span>
                          )}
                        </div>
                      )}
                      {log.errorDetails.content && (
                        <div className="text-[8px] font-mono p-1 rounded max-h-16 overflow-y-auto" style={{ color: 'var(--hermes-error, #ef4444)', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                          <div className="font-bold mb-1" style={{ color: 'var(--hermes-error, #ef4444)' }}>Content Preview:</div>
                          <div className="whitespace-pre-wrap break-all">
                            {log.errorDetails.content.length > 200 
                              ? log.errorDetails.content.substring(0, 200) + '...' 
                              : log.errorDetails.content}
                          </div>
                        </div>
                      )}
                      {log.errorDetails.stack && (
                        <details className="text-[8px] font-mono" style={{ color: 'var(--hermes-error, #ef4444)' }}>
                          <summary className="cursor-pointer">Stack Trace</summary>
                          <div className="mt-1 whitespace-pre-wrap p-1 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.1)' }}>
                            {log.errorDetails.stack}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                  {log.duration !== undefined && (
                    <span className="text-[8px] text-faint uppercase font-bold tracking-tight mt-0.5">
                      Process completed in {log.duration}ms
                    </span>
                  )}
                </div>
              </div>
            ))}
            {logs.length > 100 && (
              <div className="text-muted italic text-[9px] pt-2 px-4 border-t/10 text-center">
                ... showing last 100 of {logs.length} log entries
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-8 py-1.5 border-t/10 bg-tertiary/40 flex justify-between items-center text-xs text-faint shrink-0">
        <div className="flex items-center space-x-4">
          <span>Environment: <span className={isObsidianEnvironment ? 'text-success' : 'text-warning'}>{isObsidianEnvironment ? 'Obsidian' : 'Standalone'}</span></span>
          <span>Buffer: <span className="text-muted">{logs.length} entries</span></span>
        </div>
        <div className="text-faint">Hermes v1.1.0</div>
      </div>
    </div>
  );
};

export default KernelLog;
