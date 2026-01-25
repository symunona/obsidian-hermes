
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { TranscriptionEntry } from '../types';
import ToolResult from './ToolResult';
import { HAIKUS } from '../utils/haikus';

interface ChatWindowProps {
  transcripts: TranscriptionEntry[];
  hasSavedConversation?: boolean;
  onRestoreConversation?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ transcripts, hasSavedConversation, onRestoreConversation }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // Select a random haiku once per load
  const randomHaiku = useMemo(() => {
    return HAIKUS[Math.floor(Math.random() * HAIKUS.length)];
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isAtBottom);
  };

  useEffect(() => {
    if (shouldAutoScroll && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcripts, shouldAutoScroll]);

  const isEmpty = transcripts.length <= 1 && transcripts.every(t => t.id === 'welcome-init' || t.role === 'system');

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-grow overflow-y-auto px-8 py-8 space-y-6 scroll-smooth custom-scrollbar"
    >
      {isEmpty && (
        <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-1000">
          <div className="max-w-md space-y-8">
            <div className="space-y-4">
              <div className="w-12 h-px bg-indigo-500/30 mx-auto"></div>
              <pre className="text-sm font-mono text-slate-500 leading-relaxed">{randomHaiku.text}</pre>
              <div className="w-12 h-px bg-blue-500/30 mx-auto"></div>
              <p className="text-xs text-slate-600">
                — {randomHaiku.theme}
              </p>
            </div>
            
            <p className="text-sm text-slate-500 pt-12">
              Waiting for connection...
            </p>
            
            {hasSavedConversation && onRestoreConversation && (
              <div className="pt-8">
                <button
                  onClick={onRestoreConversation}
                  className="text-sm text-indigo-500 hover:text-indigo-400 underline transition-colors"
                >
                  Restore previous conversation
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {!isEmpty && transcripts.map((entry, idx) => {
        const isLast = idx === transcripts.length - 1;
        
        if (entry.role === 'system' && entry.toolData?.name === 'topic_switch') {
          return (
            <div key={entry.id} className="w-full py-10 flex flex-col items-center animate-in fade-in zoom-in duration-700">
              <div className="text-sm text-slate-500 font-mono text-center max-w-lg px-6 mb-5">
                "{entry.toolData.newContent}"
              </div>
              <div className="w-full flex items-center px-4 space-x-6 opacity-30">
                <div className="flex-grow h-px bg-gradient-to-r from-transparent via-indigo-500 to-indigo-500/20"></div>
                <div className="flex flex-col items-center">
                  <h3 className="text-sm font-medium text-slate-300 mb-4">System Status</h3>
                </div>
                <div className="flex-grow h-px bg-gradient-to-l from-transparent via-indigo-500 to-indigo-500/20"></div>
              </div>
            </div>
          );
        }

        return (
          <div key={entry.id} className={`flex flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
            {entry.role === 'system' ? (
              <div className="w-full">
                {entry.toolData ? (
                  <ToolResult toolData={entry.toolData} isLast={isLast} />
                ) : (
                  <div className="flex justify-center w-full py-2">
                    <div className="px-4 py-1.5 bg-indigo-500/5 border border-indigo-500/10 text-indigo-400/60 rounded-xl text-[9px] font-mono tracking-tight">
                      {entry.text}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`flex flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'} w-full`}>
                <span className={`text-[8px] font-black uppercase tracking-widest mb-1 opacity-40 ${entry.role === 'user' ? 'mr-2' : 'ml-2'}`}>
                  {entry.role === 'user' ? 'User' : 'Hermes'}
                </span>
                <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-[12px] leading-relaxed border transition-all ${
                  entry.role === 'user' ? 'bg-indigo-600 text-white border-white/10 rounded-tr-none shadow-lg' : 'bg-slate-800/60 backdrop-blur border-white/5 text-slate-200 rounded-tl-none'
                }`}>
                  {entry.text || <span className="italic opacity-30">...</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ChatWindow;
