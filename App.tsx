
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LogEntry, TranscriptionEntry, ConnectionStatus } from './types';
import { initFileSystem } from './services/mockFiles';
import { saveAppSettings, loadAppSettings } from './services/persistence';
import { GeminiVoiceAssistant } from './services/voiceInterface';

// Components
import Settings from './components/Settings';
import KernelLog from './components/KernelLog';
import ChatWindow from './components/ChatWindow';
import InputBar from './components/InputBar';

const DEFAULT_SYSTEM_INSTRUCTION = `You are an advanced voice and text assistant with file system access.
Directory structure: Virtual flat folder with .md files.
Confirm all actions. Be professional and concise.`;

const App: React.FC = () => {
  // UI State
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptionEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(true);
  
  // App Logic State
  const [voiceName, setVoiceName] = useState('Kore');
  const [customContext, setCustomContext] = useState('');
  const [systemInstruction, setSystemInstruction] = useState(DEFAULT_SYSTEM_INSTRUCTION);
  const [currentFolder, setCurrentFolder] = useState('/');
  const [currentNote, setCurrentNote] = useState<string | null>(null);
  const [diffView, setDiffView] = useState<{ filename: string, old: string, new: string } | null>(null);

  // References
  const assistantRef = useRef<GeminiVoiceAssistant | null>(null);

  /**
   * Initialize file system and load settings on mount
   */
  useEffect(() => {
    initFileSystem().then(() => addLog('Haiku Data Node Online.', 'info'));
    const saved = loadAppSettings();
    if (saved) {
      setVoiceName(saved.voiceName || 'Kore');
      setCustomContext(saved.customContext || '');
      setSystemInstruction(saved.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION);
    }
  }, []);

  /**
   * Persist settings changes
   */
  useEffect(() => {
    saveAppSettings({ voiceName, customContext, systemInstruction });
  }, [voiceName, customContext, systemInstruction]);

  /**
   * Helper to add log entries
   */
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { 
      id: Math.random().toString(36).substr(2, 9), 
      message, 
      timestamp: new Date(), 
      type 
    }]);
  }, []);

  /**
   * UI callback for assistant events
   */
  const assistantCallbacks = useMemo(() => ({
    onStatusChange: (s: ConnectionStatus) => {
      setStatus(s);
      setIsListening(s === ConnectionStatus.CONNECTED);
    },
    onLog: (m: string, t: LogEntry['type']) => addLog(m, t),
    onTranscription: (role: 'user' | 'model', text: string, isComplete: boolean) => {
      setTranscripts(prev => {
        if (prev.length === 0) return text ? [{ id: Math.random().toString(36).substr(2, 9), role, text, isComplete }] : prev;
        const lastIndex = prev.length - 1;
        const last = prev[lastIndex];
        if (last.role === role && !last.isComplete) {
          const updated = [...prev];
          updated[lastIndex] = { ...last, text: text || last.text, isComplete };
          return updated;
        }
        if (isComplete && last.role === role && last.isComplete && last.text === text) return prev;
        if (!text && isComplete) return prev;
        return [...prev, { id: Math.random().toString(36).substr(2, 9), role, text, isComplete }];
      });
    },
    onSystemMessage: (text: string) => {
      setTranscripts(prev => [...prev, { 
        id: 'sys-' + Date.now(), 
        role: 'system', 
        text, 
        isComplete: true 
      }]);
    },
    onDiffUpdate: (diff: { filename: string, old: string, new: string } | null) => setDiffView(diff),
    onInterrupted: () => {},
    onFileStateChange: (folder: string, note: string | null) => {
      setCurrentFolder(folder);
      setCurrentNote(note);
    }
  }), [addLog]);

  /**
   * Control Logic
   */
  const startSession = async () => {
    try {
      if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
      }
      
      assistantRef.current = new GeminiVoiceAssistant(assistantCallbacks);
      await assistantRef.current.start(process.env.API_KEY || '', { 
        voiceName, 
        customContext, 
        systemInstruction 
      });
      
    } catch (err) {
      setStatus(ConnectionStatus.ERROR);
    }
  };

  const stopSession = () => {
    if (assistantRef.current) {
      assistantRef.current.stop();
      assistantRef.current = null;
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    const text = inputText;
    setInputText('');
    
    assistantCallbacks.onTranscription('user', text, true);
    
    if (assistantRef.current) {
      assistantRef.current.sendText(text);
    } else {
      assistantCallbacks.onSystemMessage('[System: Voice connection required to send commands]');
    }
  };

  /**
   * Render Diff Popup
   */
  const DiffPopup = useMemo(() => {
    if (!diffView) return null;
    const oldLines = diffView.old.split('\n');
    const newLines = diffView.new.split('\n');
    const max = Math.max(oldLines.length, newLines.length);
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
        <div className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#252526]">
            <h3 className="font-mono text-xs font-bold text-slate-400">{diffView.filename}</h3>
            <button onClick={() => setDiffView(null)} className="text-slate-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-grow overflow-y-auto p-4 font-mono text-[11px] leading-6">
             <div className="grid grid-cols-[30px_1fr_30px_1fr] gap-x-1">
               {Array.from({ length: max }).map((_, i) => (
                 <React.Fragment key={i}>
                   <div className="text-slate-600 text-right pr-2 select-none opacity-50">{oldLines[i] !== undefined ? i+1 : ''}</div>
                   <div className={`${oldLines[i] !== newLines[i] && oldLines[i] !== undefined ? 'bg-red-500/20 text-red-200' : 'text-slate-500'} truncate`}>{oldLines[i] || ''}</div>
                   <div className="text-slate-600 text-right pr-2 select-none opacity-50">{newLines[i] !== undefined ? i+1 : ''}</div>
                   <div className={`${oldLines[i] !== newLines[i] && newLines[i] !== undefined ? 'bg-green-500/20 text-green-200' : 'text-slate-300'} truncate`}>{newLines[i] || ''}</div>
                 </React.Fragment>
               ))}
             </div>
          </div>
        </div>
      </div>
    );
  }, [diffView]);

  return (
    <div className="h-screen flex flex-col bg-[#0b0f1a] text-slate-200 selection:bg-indigo-500/30 overflow-hidden font-sans">
      {DiffPopup}
      
      <Settings 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        voiceName={voiceName} 
        setVoiceName={setVoiceName} 
        customContext={customContext} 
        setCustomContext={setCustomContext} 
        systemInstruction={systemInstruction}
        setSystemInstruction={setSystemInstruction}
        onUpdateApiKey={() => window.aistudio.openSelectKey()} 
      />
      
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-slate-900/60 backdrop-blur-xl shrink-0 z-50">
        <div className="flex items-center space-x-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter bg-gradient-to-br from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent uppercase">Haiku Obsidian</h1>
            <div className="flex items-center space-x-2">
              <div className={`w-1.5 h-1.5 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-emerald-500' : 'bg-slate-600'}`} />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{status}</span>
            </div>
          </div>

          <div className="hidden md:flex flex-col border-l border-white/5 pl-6">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Active Context</span>
            <div className="flex items-center space-x-3 text-[11px] font-mono">
              <span className="text-indigo-400">dir: {currentFolder}</span>
              <span className="text-slate-600">/</span>
              <span className={currentNote ? 'text-emerald-400' : 'text-slate-500 italic'}>
                note: {currentNote || 'idle'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowLogs(!showLogs)}
            className={`p-2.5 transition-all rounded-lg hover:bg-white/5 ${showLogs ? 'text-indigo-400' : 'text-slate-500 hover:text-white'}`}
            title="Toggle Console Log"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          <button 
            onClick={() => setSettingsOpen(true)}
            className="p-2.5 text-slate-500 hover:text-white transition-all rounded-lg hover:bg-white/5"
            title="Open Node Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col overflow-hidden relative pb-[80px]">
        <ChatWindow transcripts={transcripts} />
        <KernelLog isVisible={showLogs} logs={logs} onFlush={() => setLogs([])} />
        <InputBar 
          inputText={inputText} 
          setInputText={setInputText} 
          onSendText={handleSendText} 
          isListening={isListening} 
          onStartSession={startSession} 
          onStopSession={stopSession} 
          status={status} 
        />
      </main>
    </div>
  );
};

export default App;
