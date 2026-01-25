
import React from 'react';
import { isObsidianMode } from '../services/persistence';

const AVAILABLE_VOICES = ['Default', 'Professional', 'Friendly', 'Creative', 'Technical'];

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  voiceName: string;
  setVoiceName: (v: string) => void;
  customContext: string;
  setCustomContext: (c: string) => void;
  systemInstruction: string;
  setSystemInstruction: (s: string) => void;
  manualApiKey: string;
  setManualApiKey: (k: string) => void;
  onUpdateApiKey: () => void;
}

const Settings: React.FC<SettingsProps> = ({
  isOpen,
  onClose,
  voiceName,
  setVoiceName,
  customContext,
  setCustomContext,
  systemInstruction,
  setSystemInstruction,
  manualApiKey,
  setManualApiKey,
  onUpdateApiKey
}) => {
  // Handle opening settings in Obsidian vs popup
  const handleOpenSettings = () => {
    if (isObsidianMode()) {
      // In Obsidian mode, open the plugin settings
      try {
        // @ts-ignore - Obsidian API
        const { app } = window;
        if (app && app.setting) {
          app.setting.open();
          // Navigate to community plugins and find our plugin
          const communityPluginsTab = app.setting.pluginTabs.find((tab: any) => 
            tab.id === 'community-plugins'
          );
          if (communityPluginsTab) {
            app.setting.openTabById('community-plugins');
          }
        }
      } catch (error) {
        console.warn('Failed to open Obsidian settings:', error);
        // Fallback to popup if Obsidian settings fail
        return false;
      }
      return true; // Successfully opened Obsidian settings
    }
    return false; // Use popup mode
  };

  // If in Obsidian mode, try to open Obsidian settings instead of showing popup
  if (isOpen && isObsidianMode()) {
    const openedObsidianSettings = handleOpenSettings();
    if (openedObsidianSettings) {
      onClose(); // Close the popup trigger
      return null;
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300">
      <div className="max-w-3xl w-full space-y-8 bg-slate-900/50 p-12 rounded-3xl border border-white/5 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-start border-b border-white/5 pb-8">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Settings</h2>
            <p className="text-slate-500 text-sm">Hermes Voice Assistant</p>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-white/5 rounded-full transition-colors group">
            <svg className="w-8 h-8 text-slate-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-8">
          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-300 block">Voice Persona</label>
            <div className="grid grid-cols-5 gap-2">
              {AVAILABLE_VOICES.map(v => (
                <button 
                  key={v}
                  onClick={() => setVoiceName(v)}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${voiceName === v ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300 block">System Instructions</label>
            </div>
            <textarea 
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              placeholder="Core logic instructions..."
              className="w-full h-32 bg-slate-800 border border-white/10 rounded-lg p-4 text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-all font-mono placeholder:text-slate-600"
            />
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-300 block">Custom Context</label>
            <textarea 
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              placeholder="Define specific behaviors or rules for Hermes..."
              className="w-full h-20 bg-slate-800 border border-white/10 rounded-lg p-4 text-sm text-slate-200 outline-none focus:border-blue-500/50 transition-all font-mono placeholder:text-slate-600"
            />
          </div>

          <div className="space-y-4 pt-8 border-t border-white/5">
            <label className="text-sm font-medium text-slate-300 block">API Authentication</label>
            
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <span className="text-sm font-medium text-slate-400">Manual API Key</span>
                <input 
                  type="password"
                  value={manualApiKey}
                  onChange={(e) => setManualApiKey(e.target.value)}
                  placeholder="Enter your Gemini API Key..."
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-sm text-slate-200 font-mono outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                <div className="relative flex justify-center text-sm font-medium text-slate-600"><span className="bg-slate-900 px-2">Or</span></div>
              </div>

              <button 
                onClick={onUpdateApiKey}
                className="w-full flex items-center justify-center space-x-4 px-8 py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span>Google AI Studio Auth</span>
              </button>
            </div>

            <p className="text-sm text-slate-500 mt-4">
              API keys are handled via AI Studio provider or manual entry.
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline ml-1">Documentation</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
