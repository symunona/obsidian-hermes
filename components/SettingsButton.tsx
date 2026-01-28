import React from 'react';
import { isObsidian } from '../utils/environment';

interface SettingsButtonProps {
  onOpenSettings: () => void;
  className?: string;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({ onOpenSettings, className = '' }) => {
  const handleClick = () => {
    if (isObsidian()) {
      // In Obsidian mode, open Obsidian's built-in settings for this plugin
      try {
        // @ts-expect-error - Obsidian API not typed
        const { app } = window;
        if (app && app.setting) {
          app.setting.open();
          // Navigate to our plugin's settings tab
          app.setting.openTabById('hermes-voice-assistant');
        }
      } catch (error) {
        console.warn('Failed to open Obsidian settings:', error);
        // Fallback to popup if Obsidian settings fail
        onOpenSettings();
      }
    } else {
      // In standalone mode, use the popup
      onOpenSettings();
    }
  };

  return (
    <button 
      onClick={handleClick} 
      className={`p-2 hermes-text-muted hermes-hover:text-normal transition-all ${className}`}
      title="System Settings"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </button>
  );
};

export default SettingsButton;
