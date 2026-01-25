
import React, { useMemo } from 'react';
import { ConnectionStatus } from '../types';

interface InputBarProps {
  inputText: string;
  setInputText: (t: string) => void;
  onSendText: (e: React.FormEvent) => void;
  isListening: boolean;
  onStartSession: () => void;
  onStopSession: () => void;
  status: ConnectionStatus;
  activeSpeaker: 'user' | 'model' | 'none';
  volume: number;
}

const InputBar: React.FC<InputBarProps> = ({
  inputText,
  setInputText,
  onSendText,
  isListening,
  onStartSession,
  onStopSession,
  status,
  activeSpeaker,
  volume,
}) => {
  // Normalize volume for visualization (0-1)
  const normalizedVolume = useMemo(() => Math.min(1, Math.max(0, volume * 10)), [volume]);

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-[80px] px-8 bg-slate-900/95 backdrop-blur-2xl border-t border-white/5 flex items-center justify-center z-[50]">
      <div className="flex items-center space-x-6 w-full max-w-5xl">

        {/* Text Input Form */}
        <form 
          onSubmit={onSendText} 
          className="flex-grow flex items-center h-[52px] bg-slate-800/40 border border-white/10 rounded-2xl px-6 focus-within:border-indigo-500/50 focus-within:bg-slate-800/60 transition-all shadow-inner overflow-hidden mb-0"
        >
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message Hermes..." 
            className="flex-grow bg-transparent border-none outline-none text-sm text-slate-200 placeholder:text-slate-600 h-full"
          />
          <button 
            type="submit" 
            className="flex items-center justify-center p-1 ml-2 text-slate-500 hover:text-indigo-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </form>

        {/* Voice Interface Action Button */}
        <div className="shrink-0 flex items-center">
          {isListening ? (
            <button 
              onClick={onStopSession} 
              className="w-[220px] h-[52px] flex items-center justify-between px-6 bg-red-500/10 border border-red-500/40 text-red-400 rounded-2xl hover:bg-red-500/20 transition-all shadow-lg active:scale-[0.98] relative overflow-hidden group"
              title="Stop Listening"
            >
              {/* Left: User Icon */}
              <div className={`flex flex-col items-center transition-all duration-300 ${activeSpeaker === 'user' ? 'text-red-300 scale-110' : 'opacity-30'}`}>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="text-[7px] font-black uppercase tracking-tighter mt-0.5">Mortal</span>
              </div>

              {/* Center: Sound Wave Visualizer */}
              <div className="flex items-center justify-center flex-1 space-x-1.5 h-full relative">
                {[0, 1, 2].map((i) => {
                  const h = activeSpeaker === 'user' 
                    ? Math.max(4, normalizedVolume * (24 + i * 4)) 
                    : activeSpeaker === 'model' 
                      ? Math.max(4, 16 + Math.sin(Date.now() / 100 + i) * 8)
                      : 4;
                  return (
                    <div 
                      key={i} 
                      style={{ height: `${h}px` }}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        activeSpeaker === 'user' ? 'bg-red-400' : 
                        activeSpeaker === 'model' ? 'bg-emerald-400' : 
                        'bg-red-900/40'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Right: Robot Icon */}
              <div className={`flex flex-col items-center transition-all duration-300 ${activeSpeaker === 'model' ? 'text-emerald-300 scale-110' : 'opacity-30'}`}>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <circle cx="12" cy="5" r="2" />
                  <path d="M12 7v4" />
                  <line x1="8" y1="16" x2="8" y2="16" />
                  <line x1="16" y1="16" x2="16" y2="16" />
                </svg>
                <span className="text-[7px] font-black uppercase tracking-tighter mt-0.5">Hermes</span>
              </div>

              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
          ) : (
            <button 
              onClick={onStartSession}
              disabled={status === ConnectionStatus.CONNECTING}
              className="w-[52px] h-[52px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg transition-all disabled:opacity-50 border border-indigo-400/20 active:scale-95 group"
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
