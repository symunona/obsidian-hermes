
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { TranscriptionEntry } from '../types';
import SystemMessage from './SystemMessage';
import MarkdownRenderer from './MarkdownRenderer';
import { HAIKUS } from '../utils/haikus';

interface ChatWindowProps {
  transcripts: TranscriptionEntry[];
  hasSavedConversation?: boolean;
  onRestoreConversation?: () => void;
  onImageDownload?: (image: any, index: number) => void;
}

const getSystemMessageType = (text: string): 'error' | 'warning' | 'success' | 'info' => {
  const lower = text.toLowerCase();
  if (lower.includes('error') || lower.includes('missing') || lower.includes('failed')) return 'error';
  if (lower.includes('warning') || lower.includes('caution')) return 'warning';
  if (lower.includes('success') || lower.includes('complete') || lower.includes('saved')) return 'success';
  return 'info';
};

const ChatWindow: React.FC<ChatWindowProps> = ({ transcripts, hasSavedConversation, onRestoreConversation, onImageDownload }) => {
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
      className="flex-1 min-h-0 overflow-y-auto px-8 py-8 space-y-6 scroll-smooth custom-scrollbar"
    >
      {isEmpty && (
        <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-1000">
          <div className="max-w-md space-y-8">
            <div className="space-y-4">
              <div className="w-12 h-px hermes-interactive-bg/30 mx-auto"></div>
              <pre className="text-sm font-mono hermes-text-muted leading-relaxed">{randomHaiku.text}</pre>
              <div className="w-12 h-px hermes-interactive-bg/30 mx-auto"></div>
              <p className="text-xs hermes-text-faint">
                — {randomHaiku.theme}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {!isEmpty && transcripts.map((entry, idx) => {
        const isLast = idx === transcripts.length - 1;
        
        if (entry.role === 'system' && entry.toolData?.name === 'topic_switch') {
          return (
            <div key={entry.id} className="w-full py-10 flex flex-col items-center animate-in fade-in zoom-in duration-700">
              <div className="text-sm hermes-text-muted font-mono text-center max-w-lg px-6 mb-5">
                "{entry.toolData.newContent}"
              </div>
              <div className="w-full flex items-center px-4 space-x-6 opacity-30">
                <div className="flex-grow h-px bg-gradient-to-r from-transparent via-interactive to-interactive/20"></div>
                <div className="flex flex-col items-center">
                  <h3 className="text-sm font-medium hermes-text-normal mb-4">System Status</h3>
                </div>
                <div className="flex-grow h-px bg-gradient-to-l from-transparent via-interactive to-interactive/20"></div>
              </div>
            </div>
          );
        }

        return (
          <div key={entry.id} className={`flex flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
            {entry.role === 'system' ? (
              <div className="w-full">
                <div className="flex justify-center w-full py-2">
                  <SystemMessage toolData={entry.toolData} isLast={isLast} onImageDownload={onImageDownload}>
                    {entry.text}
                  </SystemMessage>
                </div>
              </div>
            ) : (
              <div className={`flex flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'} w-full`}>
                <span className={`text-[8px] font-black uppercase tracking-widest mb-1 opacity-40 ${entry.role === 'user' ? 'mr-2' : 'ml-2'}`}>
                  {entry.role === 'user' ? 'User' : 'Hermes'}
                </span>
                <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-[12px] leading-relaxed border transition-all ${
                  entry.role === 'user' ? 'hermes-user-msg-bg hermes-user-msg-text hermes-border/10 rounded-tr-none shadow-lg' : 'hermes-hermes-msg-bg hermes-hermes-msg-text hermes-border/20 rounded-tl-none'
                }`}>
                  {entry.role === 'user' ? (
                    entry.text || <span className="italic opacity-30">...</span>
                  ) : (
                    <MarkdownRenderer content={entry.text || ''} className="hermes-hermes-msg-text" />
                  )}
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
