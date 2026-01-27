import React from 'react';

interface UserMessageProps {
  text: string;
}

const UserMessage: React.FC<UserMessageProps> = ({ text }) => {
  return (
    <div className="flex flex-col items-end w-full m-1">
      <span className="text-[8px] font-black uppercase tracking-widest mb-1 opacity-40 mr-2">
      </span>
      <div 
        className="max-w-[85%] px-5 py-3 rounded-2xl text-[12px] leading-relaxed border transition-all hermes-user-msg-bg hermes-user-msg-text hermes-border/10 rounded-tr-none shadow-lg"
        style={{ userSelect: 'text', WebkitUserSelect: 'text', MozUserSelect: 'text', msUserSelect: 'text' }}
      >
        {text || <span className="italic opacity-30">...</span>}
      </div>
    </div>
  );
};

export default UserMessage;
