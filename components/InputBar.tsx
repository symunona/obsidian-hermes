
import React from 'react';
import { ConnectionStatus } from '../types';

interface InputBarProps {
  inputText: string;
  setInputText: (t: string) => void;
  onSendText: (e: React.FormEvent) => void;
  isListening: boolean;
  onStartSession: () => void;
  onStopSession: () => void;
  status: ConnectionStatus;
}

const InputBar: React.FC<InputBarProps> = ({
  inputText,
  setInputText,
  onSendText,
  isListening,
  onStartSession,
  onStopSession,
  status,
}) => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-[80px] px-8 bg-slate-900/95 backdrop-blur-2xl border-t border-white/5 flex items-center justify-center z-[50]">
      <div className="flex items-center space-x-4 w-full max-w-5xl">
        
        {/* Text Input Form - mb-0 added to ensure no bottom margin */}
        <form 
          onSubmit={onSendText} 
          className="flex-grow flex items-center h-[52px] bg-slate-800/40 border border-white/10 rounded-2xl px-6 group focus-within:border-indigo-500/50 focus-within:bg-slate-800/60 transition-all shadow-inner overflow-hidden mb-0"
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
              className="w-[52px] h-[52px] flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg active:scale-95 group"
              title="Stop Listening"
            >
              <div className="relative flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z" />
                </svg>
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              </div>
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
