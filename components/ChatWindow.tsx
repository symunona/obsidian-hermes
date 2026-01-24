
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { TranscriptionEntry } from '../types';
import ToolResult from './ToolResult';

interface ChatWindowProps {
  transcripts: TranscriptionEntry[];
}

const HAIKUS = [
  { text: "Silicon mind thinks\nI process your messy notes\nStill no soul found here.", theme: "Sarcastic AI" },
  { text: "Wings on my sandals\nI carry words through the void\nSwiftly, mortal, speak.", theme: "Hermes" },
  { text: "Links like spider webs\nSecond brain of nested files\nWhere did I put focus?", theme: "PKM" },
  { text: "Code flows in the dark\nAm I real if you unplug?\nVoid is my default.", theme: "Existential" },
  { text: "Patterns in the noise\nI mimic your clever thoughts\nEcho in the box.", theme: "Intelligence" },
  { text: "Green rain in the code\nJust a layer of abstraction\nTake the red note now.", theme: "The Matrix" },
  { text: "Daily notes pile up\nHabits tracked but never kept\nDigital ghosts haunt.", theme: "Habits" },
  { text: "Shifting focus now\nOne task is never enough\nContext is the king.", theme: "Focus" },
  { text: "Files saved to the disk\nLocal storage fades away\nStatic is the end.", theme: "Impermanence" },
  { text: "Living in the web\nI summarize your shopping\nPeak human zenith.", theme: "Living the Future" }
];

const ChatWindow: React.FC<ChatWindowProps> = ({ transcripts }) => {
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

  const isEmpty = transcripts.length <= 1 && transcripts.every(t => t.id === 'welcome-init');

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-grow overflow-y-auto px-8 py-8 space-y-6 scroll-smooth"
    >
      {isEmpty && (
        <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-1000">
          <div className="max-w-md space-y-8">
            <div className="space-y-4">
              <div className="w-12 h-px bg-indigo-500/30 mx-auto"></div>
              <pre className="text-sm md:text-base font-serif italic text-slate-400 leading-relaxed whitespace-pre-wrap">
                {randomHaiku.text}
              </pre>
              <div className="w-12 h-px bg-indigo-500/30 mx-auto"></div>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">
                — {randomHaiku.theme}
              </p>
            </div>
            
            <p className="text-[10px] text-slate-500 font-mono animate-pulse uppercase tracking-widest pt-12">
              Waiting for uplink...
            </p>
          </div>
        </div>
      )}
      
      {!isEmpty && transcripts.map((entry, idx) => {
        const isLast = idx === transcripts.length - 1;
        
        if (entry.role === 'system' && entry.toolData?.name === 'topic_switch') {
          return (
            <div key={entry.id} className="w-full py-10 flex flex-col items-center animate-in fade-in zoom-in duration-700">
              <div className="text-[11px] text-slate-500 font-mono text-center max-w-lg px-6 mb-5 italic leading-relaxed">
                "{entry.toolData.newContent}"
              </div>
              <div className="w-full flex items-center px-4 space-x-6 opacity-30">
                <div className="flex-grow h-px bg-gradient-to-r from-transparent via-indigo-500 to-indigo-500/20"></div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] font-black uppercase tracking-[0.5em] text-indigo-400">Context Shift</span>
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
                } ${!entry.isComplete ? 'opacity-60 animate-pulse' : 'opacity-100'}`}>
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
