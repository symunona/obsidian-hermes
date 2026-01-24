
import React, { useRef, useEffect } from 'react';
import { TranscriptionEntry } from '../types';

interface ChatWindowProps {
  transcripts: TranscriptionEntry[];
}

const ChatWindow: React.FC<ChatWindowProps> = ({ transcripts }) => {
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTo({
        top: transcriptContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcripts]);

  return (
    <div 
      ref={transcriptContainerRef}
      className="flex-grow overflow-y-auto px-8 py-8 space-y-6 scroll-smooth"
    >
      {transcripts.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center opacity-30 text-center space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4">System Online</p>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <div className="text-[9px] bg-white/5 border border-white/5 p-3 rounded-xl italic">"Show directory"</div>
            <div className="text-[9px] bg-white/5 border border-white/5 p-3 rounded-xl italic">"Create haiku"</div>
            <div className="text-[9px] bg-white/5 border border-white/5 p-3 rounded-xl italic">"Edit first.md"</div>
            <div className="text-[9px] bg-white/5 border border-white/5 p-3 rounded-xl italic">"Read third.md"</div>
          </div>
        </div>
      )}
      {transcripts.map((entry) => (
        <div key={entry.id} className={`flex flex-col ${entry.role === 'user' ? 'items-end' : entry.role === 'system' ? 'items-center' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
          {entry.role === 'system' ? (
            <div className="px-4 py-1.5 bg-indigo-500/5 border border-indigo-500/10 text-indigo-400/60 rounded-xl text-[9px] font-mono tracking-tight">
              {entry.text}
            </div>
          ) : (
            <>
              <span className={`text-[8px] font-black uppercase tracking-widest mb-1 opacity-40 ${entry.role === 'user' ? 'mr-2' : 'ml-2'}`}>
                {entry.role === 'user' ? 'User' : 'Haiku Assistant'}
              </span>
              <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-[12px] leading-relaxed border transition-all ${
                entry.role === 'user' ? 'bg-indigo-600 text-white border-white/10 rounded-tr-none' : 'bg-slate-800/60 backdrop-blur border-white/5 text-slate-200 rounded-tl-none'
              } ${!entry.isComplete ? 'opacity-60 animate-pulse' : 'opacity-100'}`}>
                {entry.text || <span className="italic opacity-30">...</span>}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default ChatWindow;
