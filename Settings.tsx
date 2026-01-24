
import React from 'react';

const AVAILABLE_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  voiceName: string;
  setVoiceName: (v: string) => void;
  customContext: string;
  setCustomContext: (c: string) => void;
  onUpdateApiKey: () => void;
}

const Settings: React.FC<SettingsProps> = ({
  isOpen,
  onClose,
  voiceName,
  setVoiceName,
  customContext,
  setCustomContext,
  onUpdateApiKey
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-8 animate-in fade-in duration-300">
      <div className="max-w-2xl w-full space-y-12">
        <div className="flex justify-between items-start border-b border-white/5 pb-8">
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">System Settings</h2>
            <p className="text-slate-500 font-mono text-sm tracking-tight uppercase">Configuration Node — Haiku v1.0.5</p>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-white/5 rounded-full transition-colors">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-12">
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 block">Voice Assistant Voice</label>
            <div className="grid grid-cols-3 gap-3">
              {AVAILABLE_VOICES.map(v => (
                <button 
                  key={v}
                  onClick={() => setVoiceName(v)}
                  className={`px-4 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${voiceName === v ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 block">Custom System Context (Added every session)</label>
            <textarea 
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              placeholder="Define specific behaviors, personalities, or rules for the AI..."
              className="w-full h-32 bg-slate-900/60 border border-white/10 rounded-2xl p-6 text-sm text-slate-200 outline-none focus:border-indigo-500/50 transition-all font-mono placeholder:text-slate-800"
            />
          </div>

          <div className="space-y-4 pt-8 border-t border-white/5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 block">Identity & Security</label>
            <button 
              onClick={onUpdateApiKey}
              className="flex items-center space-x-4 px-8 py-5 bg-white text-slate-950 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all active:scale-[0.98]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>Update Google API Key</span>
            </button>
            <p className="text-[10px] text-slate-500 font-medium">
              Your API key is stored securely within your browser environment. 
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline ml-1">Learn more about billing.</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
