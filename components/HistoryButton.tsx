import React from 'react';

interface HistoryButtonProps {
  onOpenHistory: () => void;
  isListening?: boolean;
}

const HistoryButton: React.FC<HistoryButtonProps> = ({ onOpenHistory, isListening }) => {
  return (
    <button 
      onClick={onOpenHistory}
      className="p-2 transition-all hermes-hover:text-normal border-none"
      style={{
        backgroundColor: isListening ? 'var(--hermes-button-text-listening)' : undefined,
        color: isListening ? 'white' : undefined,
      }}
      title="View History"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
};

export default HistoryButton;
