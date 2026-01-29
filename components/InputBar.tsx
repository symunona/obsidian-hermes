
import React, { useState, useEffect, useRef } from 'react';
import { ConnectionStatus } from '../types';
import { loadChatHistory } from '../persistence/persistence';

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
  hasApiKey: boolean;
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
  volume: _volume,
  hasApiKey,
}) => {
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chat history on component mount
  useEffect(() => {
    const history = loadChatHistory();
    setChatHistory(history);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (chatHistory.length > 0) {
        const newIndex = historyIndex < chatHistory.length - 1 ? historyIndex + 1 : chatHistory.length - 1;
        setHistoryIndex(newIndex);
        setInputText(chatHistory[chatHistory.length - 1 - newIndex]);
        
        // Select all text when navigating through history
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.select();
          }
        }, 0);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputText(chatHistory[chatHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputText('');
      }
    } else if (e.key === 'Escape') {
      setHistoryIndex(-1);
    } else {
      // Reset history index when typing anything else
      setHistoryIndex(-1);
    }
  };

  return (
    <footer className={`h-[100px] pb-5 px-8 backdrop-blur-2xl hermes-border-t flex items-center justify-center shrink-0 ${
      isListening ? 'hermes-footer-bg-listening' : 'hermes-footer-bg'
    }`}>
      <div className="flex items-center space-x-6 w-full max-w-5xl">

        {/* Text Input Form */}
        <form 
          onSubmit={onSendText} 
          className="flex-grow flex items-center"
        >
          <input 
            ref={inputRef}
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !hasApiKey 
                ? "API key required..." 
                : isListening 
                  ? "Voice session active - speak to interact" 
                  : "Press Ctrl+Shift+L for starting/stopping talking to your vault assistant"
            }
            disabled={!hasApiKey || isListening}
            className={`flex-1 h-[52px] hermes-input-bg hermes-input-text hermes-input-border border rounded-lg px-4 text-sm focus:outline-none focus:hermes-input-border-focus ${
              !hasApiKey || isListening ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
          <button 
            type="submit" 
            disabled={!hasApiKey || !inputText.trim()}
            className={`flex items-center justify-center w-[52px] h-[52px] ml-2 transition-colors ${
              hasApiKey && inputText.trim() 
                ? 'hermes-text-muted hermes-hover:text-normal' 
                : 'opacity-50 cursor-not-allowed'
            }`}
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
              className={`w-[52px] h-[52px] flex items-center justify-center rounded-full transition-all active:scale-95 group ${
                activeSpeaker === 'user' 
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 animate-pulse hover:scale-110 hover:bg-red-600' 
                  : 'bg-red-500 text-white hover:scale-110 hover:bg-red-600'
              }`}
              title="Stop Listening"
            >
              <svg className="w-6 h-6 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button 
              onClick={onStartSession}
              disabled={status === ConnectionStatus.CONNECTING || !hasApiKey}
              className={`w-[52px] h-[52px] flex items-center justify-center rounded-full transition-all active:scale-95 group ${
                hasApiKey 
                  ? activeSpeaker === 'user' 
                    ? 'bg-[var(--hermes-text-accent,#7c3aed)] text-white shadow-lg shadow-[var(--hermes-text-accent,#7c3aed)]/50 animate-pulse hover:scale-110 hover:bg-[var(--hermes-text-accent-dark,#6d28d9)]'
                    : 'bg-[var(--hermes-brand,#6366f1)] text-white hover:scale-110 hover:bg-[var(--hermes-brand-dark,#4f46e5)]'
                  : 'opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-700'
              }`}
              title={hasApiKey ? "Start Voice Session" : "API key required"}
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
