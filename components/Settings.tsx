
import React from 'react';

const AVAILABLE_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300">
      <div className="max-w-3xl w-full space-y-8 bg-slate-900/50 p-12 rounded-3xl border border-white/5 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-start border-b border-white/5 pb-8">
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">System Settings</h2>
            <p className="text-slate-500 font-mono text-sm tracking-tight uppercase">Configuration Node — Hermes OS v1.1.0</p>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-white/5 rounded-full transition-colors group">
            <svg className="w-8 h-8 text-slate-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid gap-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 block">Hermes Voice Persona</label>
            <div className="grid grid-cols-5 gap-2">
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
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 block">System Core Instruction</label>
              <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider">Warning: Critical logic paths</span>
            </div>
            <textarea 
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              placeholder="Core logic instructions..."
              className="w-full h-40 bg-slate-950 border border-white/10 rounded-2xl p-6 text-[11px] text-slate-400 outline-none focus:border-red-500/30 transition-all font-mono placeholder:text-slate-800 shadow-inner leading-relaxed"
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 block">Custom Context & Knowledge</label>
            <textarea 
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              placeholder="Define specific behaviors or rules for Hermes..."
              className="w-full h-24 bg-slate-950 border border-white/10 rounded-2xl p-6 text-sm text-slate-200 outline-none focus:border-indigo-500/50 transition-all font-mono placeholder:text-slate-800 shadow-inner"
            />
          </div>

          <div className="space-y-4 pt-8 border-t border-white/5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 block">Authentication</label>
            
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Manual API Key Entry</span>
                <input 
                  type="password"
                  value={manualApiKey}
                  onChange={(e) => setManualApiKey(e.target.value)}
                  placeholder="Enter your Gemini API Key..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 font-mono outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                <div className="relative flex justify-center text-[8px] uppercase font-black text-slate-600"><span className="bg-slate-900 px-2">Or Use Provider</span></div>
              </div>

              <button 
                onClick={onUpdateApiKey}
                className="w-full flex items-center justify-center space-x-4 px-8 py-4 bg-white text-slate-950 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all active:scale-[0.98] shadow-xl"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span>Google AI Studio Auth</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 font-medium mt-4">
              API keys are handled via the AI Studio provider or manual entry.
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline ml-1">Docs.</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
