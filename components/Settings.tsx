
import React from 'react';

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
  serperApiKey: string;
  setSerperApiKey: (key: string) => void;
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
  serperApiKey,
  setSerperApiKey,
  onUpdateApiKey
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] hermes-bg-tertiary/95 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300">
      <div className="max-w-3xl w-full space-y-8 hermes-glass p-12 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-start hermes-border-b pb-8">
          <div>
            <h2 className="text-2xl font-semibold mb-2 hermes-text-normal">Settings</h2>
            <p className="hermes-text-muted text-sm">Hermes Voice Assistant</p>
          </div>
          <button onClick={onClose} className="p-4 hermes-hover:bg-secondary/5 rounded-full transition-colors group">
            <svg className="w-8 h-8 hermes-text-muted group-hover:hermes-text-normal transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-8">
          <div className="space-y-4">
            <label className="text-sm font-medium hermes-text-normal block">Voice Persona</label>
            <div className="grid grid-cols-5 gap-2">
              {AVAILABLE_VOICES.map(v => (
                <button 
                  key={v}
                  onClick={() => setVoiceName(v)}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${voiceName === v ? 'hermes-interactive-bg border-interactive hermes-text-normal' : 'hermes-bg-secondary/5 hermes-border/10 hermes-text-muted hermes-hover:border/20'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium hermes-text-normal block">System Instructions</label>
            </div>
            <textarea 
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              placeholder="Core logic instructions..."
              className="w-full h-32 hermes-bg-tertiary hermes-border/10 rounded-lg p-4 text-sm hermes-text-normal outline-none hermes-focus:border/50 transition-all font-mono placeholder:hermes-text-faint"
            />
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium hermes-text-normal block">Custom Context</label>
            <textarea 
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              placeholder="Define specific behaviors or rules for Hermes..."
              className="w-full h-20 hermes-bg-tertiary hermes-border/10 rounded-lg p-4 text-sm hermes-text-normal outline-none hermes-focus:border/50 transition-all font-mono placeholder:hermes-text-faint"
            />
          </div>

          <div className="space-y-4 pt-8 hermes-border-t">
            <label className="text-sm font-medium hermes-text-normal block">API Authentication</label>
            
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <span className="text-sm font-medium hermes-text-muted">Manual API Key</span>
                <input 
                  type="password"
                  value={manualApiKey}
                  onChange={(e) => setManualApiKey(e.target.value)}
                  placeholder="Enter your Gemini API Key..."
                  className="w-full hermes-bg-tertiary hermes-border/10 rounded-lg px-4 py-3 text-sm hermes-text-normal font-mono outline-none hermes-focus:border/50 transition-all"
                />
              </div>

              <div className="flex flex-col space-y-2">
                <span className="text-sm font-medium hermes-text-muted">Serper API Key (for Image Search)</span>
                <input 
                  type="password"
                  value={serperApiKey}
                  onChange={(e) => setSerperApiKey(e.target.value)}
                  placeholder="Enter your Serper API Key..."
                  className="w-full hermes-bg-tertiary hermes-border/10 rounded-lg px-4 py-3 text-sm hermes-text-normal font-mono outline-none hermes-focus:border/50 transition-all"
                />
                <p className="text-xs hermes-text-faint">
                  Get 2,500 free credits at <a href="https://serper.dev/" target="_blank" rel="noreferrer" className="hermes-text-accent hover:underline">serper.dev</a>
                </p>
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full hermes-border-t"></div></div>
                <div className="relative flex justify-center text-sm font-medium hermes-text-faint"><span className="hermes-bg-secondary px-2">Or</span></div>
              </div>

              <button 
                onClick={onUpdateApiKey}
                className="w-full flex items-center justify-center space-x-4 px-8 py-4 hermes-interactive-bg hermes-text-normal rounded-lg font-medium hermes-hover:interactive-bg transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span>Google AI Studio Auth</span>
              </button>
            </div>

            <p className="text-sm hermes-text-muted mt-4">
              API keys are handled via AI Studio provider or manual entry.
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="hermes-text-accent hover:underline ml-1">Documentation</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
