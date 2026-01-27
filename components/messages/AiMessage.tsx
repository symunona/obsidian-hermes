import React from 'react';
import MarkdownRenderer from '../MarkdownRenderer';

interface AiMessageProps {
  text: string;
}

const AiMessage: React.FC<AiMessageProps> = ({ text }) => {
  return (
    <div className="flex flex-col items-start w-full m-1">
      <span className="text-[8px] font-black uppercase tracking-widest mb-1 opacity-40 ml-2">
        Hermes
      </span>
      <div 
        className="max-w-[85%] px-5 py-3 rounded-2xl text-[12px] leading-relaxed border transition-all hermes-hermes-msg-bg hermes-hermes-msg-text hermes-border/20 rounded-tl-none"
        style={{ userSelect: 'text', WebkitUserSelect: 'text', MozUserSelect: 'text', msUserSelect: 'text' }}
      >
        <MarkdownRenderer content={text || ''} className="hermes-hermes-msg-text" />
      </div>
    </div>
  );
};

export default AiMessage;
