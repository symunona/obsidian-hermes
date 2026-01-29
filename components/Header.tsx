
import React from 'react';
import { ConnectionStatus, TranscriptionEntry } from '../types';
import SettingsButton from './SettingsButton';
import HistoryButton from './HistoryButton';

interface HeaderProps {
  status: ConnectionStatus;
  showLogs: boolean;
  onToggleLogs: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  isListening?: boolean;
  onStopSession?: () => void;
  onResetConversation?: () => void;
  transcripts?: TranscriptionEntry[];
}

const Header: React.FC<HeaderProps> = ({ status: _status, showLogs: _showLogs, onToggleLogs: _onToggleLogs, onOpenSettings, onOpenHistory, isListening, onStopSession, onResetConversation, transcripts }) => {
  // Check if there's content in the conversation (more than just welcome message)
  const hasContent = transcripts && transcripts.length > 1 && !transcripts.every(t => t.id === 'welcome-init' || t.role === 'system');
  
  return (
    <header className={`relative flex items-center justify-between px-6 py-2 hermes-border-b shrink-0 z-50 ${
      isListening ? 'hermes-header-bg-listening' : 'hermes-header-bg'
    }`}>
      <div className="flex items-center space-x-6">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-semibold transition-all" style={{
              color: isListening ? 'var(--hermes-header-text-listening)' : 'var(--hermes-text-normal)'
            }}>Hermes</h1>
            {hasContent && onResetConversation && (
              <button 
                onClick={onResetConversation}
                className="w-8 h-8 p-1 rounded transition-all hover:hermes-text-normal border-none"
                style={{
                  backgroundColor: isListening ? 'var(--hermes-button-text-listening)' : undefined,
                  color: isListening ? 'white' : undefined,
                }}
                title="Reset conversation"
              >
                +
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Center: Red Mic Button (only shown when listening) */}
      {isListening && (
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
          <button 
            onClick={onStopSession}
            className="w-[52px] h-[52px] flex items-center justify-center bg-green-600 text-white rounded-full transition-all hover:bg-green-700 active:scale-95 shadow-lg shadow-green-600/50"
            title="Stop Listening"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="2" />
              <path d="M12 7v4" />
              <line x1="8" y1="16" x2="8" y2="16" />
              <line x1="16" y1="16" x2="16" y2="16" />
            </svg>
          </button>
        </div>
      )}
      
      <div className="flex items-center space-x-1">
        {/* <button 
          onClick={onToggleLogs} 
          className={`p-2 transition-all ${showLogs ? 'hermes-text-accent' : 'hermes-text-muted hermes-hover:text-normal'}`}
          title="Toggle System Log"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button> */}
        
        <HistoryButton onOpenHistory={onOpenHistory} isListening={isListening} />
        <SettingsButton onOpenSettings={onOpenSettings} isListening={isListening} />
      </div>
    </header>
  );
};

export default Header;
