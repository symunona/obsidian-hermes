
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LogEntry, TranscriptionEntry, ConnectionStatus, ToolData } from './types';
import { initFileSystem, listDirectory } from './services/mockFiles';
import { saveAppSettings, loadAppSettings } from './services/persistence';
import { GeminiVoiceAssistant } from './services/voiceInterface';
import { DEFAULT_SYSTEM_INSTRUCTION } from './defaultPrompt';
import { COMMAND_DECLARATIONS } from './services/commands';

// Components
import Settings from './components/Settings';
import KernelLog from './components/KernelLog';
import ChatWindow from './components/ChatWindow';
import InputBar from './components/InputBar';

const App: React.FC = () => {
  // Initial State Hydration from LocalStorage
  const saved = useMemo(() => {
    const data = loadAppSettings();
    return data || {};
  }, []);

  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [inputText, setInputText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  
  const [transcripts, setTranscripts] = useState<TranscriptionEntry[]>(() => saved.transcripts || []);
  const [voiceName, setVoiceName] = useState<string>(() => saved.voiceName || 'Zephyr');
  const [customContext, setCustomContext] = useState<string>(() => saved.customContext || '');
  const [systemInstruction, setSystemInstruction] = useState<string>(() => saved.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION);
  const [manualApiKey, setManualApiKey] = useState<string>(() => saved.manualApiKey || '');
  const [currentFolder, setCurrentFolder] = useState<string>(() => saved.currentFolder || '/');
  const [currentNote, setCurrentNote] = useState<string | null>(() => saved.currentNote || null);
  const [totalTokens, setTotalTokens] = useState<number>(() => saved.totalTokens || 0);
  const [fileCount, setFileCount] = useState<number>(0);

  const assistantRef = useRef<GeminiVoiceAssistant | null>(null);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', duration?: number) => {
    setLogs(prev => [...prev, { 
      id: Math.random().toString(36).substr(2, 9), 
      message, 
      timestamp: new Date(), 
      type,
      duration
    }]);
  }, []);

  // Initialize VFS and Welcome Content
  useEffect(() => {
    initFileSystem().then(() => {
      const files = listDirectory();
      setFileCount(files.length);
      
      // Populate manifest in log
      addLog(`Initializing Hermes Core...`, 'info');
      COMMAND_DECLARATIONS.forEach(cmd => {
        addLog(`[${cmd.name}] ${cmd.description}`, 'info');
      });
      addLog(`File system ready: ${files.length} records loaded.`, 'info');
      
      if (transcripts.length === 0) {
        setTranscripts([{
          id: 'welcome-init',
          role: 'system',
          text: 'HERMES OS INITIALIZED. READY FOR UPLINK.',
          isComplete: true,
          timestamp: Date.now()
        }]);
      }
    });
  }, [addLog]);

  // Save state on updates
  useEffect(() => {
    saveAppSettings({
      transcripts,
      voiceName,
      customContext,
      systemInstruction,
      manualApiKey,
      currentFolder,
      currentNote,
      totalTokens
    });
  }, [transcripts, voiceName, customContext, systemInstruction, manualApiKey, currentFolder, currentNote, totalTokens]);

  const assistantCallbacks = useMemo(() => ({
    onStatusChange: (s: ConnectionStatus) => {
      setStatus(s);
      if (s === ConnectionStatus.CONNECTED) {
        addLog('UPLINK ESTABLISHED. Quantum connection stable.', 'info');
        setTranscripts(prev => [...prev, {
          id: 'sys-uplink-' + Date.now(),
          role: 'system',
          text: '--- QUANTUM UPLINK ESTABLISHED ---',
          isComplete: true,
          timestamp: Date.now()
        }]);
      } else if (s === ConnectionStatus.DISCONNECTED) {
        addLog('Uplink terminated.', 'info');
      }
    },
    onLog: (m: string, t: LogEntry['type'], d?: number) => addLog(m, t, d),
    onTranscription: (role: 'user' | 'model', text: string, isComplete: boolean) => {
      setTranscripts(prev => {
        const activeEntryIndex = prev.reduceRight((acc, entry, index) => {
          if (acc !== -1) return acc;
          return (entry.role === role && !entry.isComplete) ? index : -1;
        }, -1);

        if (activeEntryIndex !== -1) {
          const updated = [...prev];
          updated[activeEntryIndex] = { ...updated[activeEntryIndex], text: text || updated[activeEntryIndex].text, isComplete };
          return updated;
        }

        return [...prev, { id: Math.random().toString(36).substr(2, 9), role, text, isComplete, timestamp: Date.now() }];
      });
    },
    onSystemMessage: (text: string, toolData?: ToolData) => {
      setTranscripts(prev => [...prev, { 
        id: 'sys-' + Date.now(), 
        role: 'system', 
        text, 
        isComplete: true,
        toolData,
        timestamp: Date.now()
      }]);
      setFileCount(listDirectory().length);
    },
    onInterrupted: () => {},
    onFileStateChange: (folder: string, note: string | null) => {
      setCurrentFolder(folder);
      setCurrentNote(note);
    },
    onUsageUpdate: (usage: any) => {
      const tokens = usage.totalTokenCount || usage.totalTokens;
      if (tokens) setTotalTokens(tokens);
    }
  }), [addLog]);

  const startSession = async () => {
    try {
      const activeKey = manualApiKey.trim() || process.env.API_KEY || '';
      if (!activeKey) {
        // @ts-ignore
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
          // @ts-ignore
          await window.aistudio.openSelectKey();
        }
      }
      assistantRef.current = new GeminiVoiceAssistant(assistantCallbacks);
      await assistantRef.current.start(activeKey, { voiceName, customContext, systemInstruction }, { folder: currentFolder, note: currentNote });
    } catch (err: any) {
      addLog(`Session Init Failure: ${err.message}`, 'error');
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
      assistantCallbacks.onSystemMessage('[Link Offline: Connection required to send data]');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0b0f1a] text-slate-200 selection:bg-indigo-500/30 overflow-hidden font-sans">
      <Settings 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        voiceName={voiceName} 
        setVoiceName={setVoiceName} 
        customContext={customContext} 
        setCustomContext={setCustomContext} 
        systemInstruction={systemInstruction}
        setSystemInstruction={setSystemInstruction}
        manualApiKey={manualApiKey}
        setManualApiKey={setManualApiKey}
        onUpdateApiKey={() => (window as any).aistudio.openSelectKey()} 
      />
      
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-slate-900/60 backdrop-blur-xl shrink-0 z-50">
        <div className="flex items-center space-x-6">
          <div className="flex flex-col">
            <h1 className={`text-xl font-black tracking-tighter bg-gradient-to-br from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent uppercase transition-all duration-700 ${status === ConnectionStatus.CONNECTED ? 'animate-pulse scale-105' : ''}`}>
              Hermes
            </h1>
            <div className="flex items-center space-x-2">
              <div className={`w-1.5 h-1.5 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : status === ConnectionStatus.ERROR ? 'bg-red-500' : 'bg-slate-600'}`} />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{status}</span>
            </div>
          </div>

          <div className="hidden md:flex flex-col border-l border-white/5 pl-6">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">VFS Status</span>
            <div className="flex items-center space-x-3 text-[11px] font-mono">
              <span className="text-indigo-400">{fileCount} records</span>
              <span className="text-slate-600">|</span>
              <span className={currentNote ? 'text-emerald-400' : 'text-slate-500 italic'}>
                {currentNote || 'idle'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowLogs(!showLogs)} 
            className={`p-2.5 transition-all rounded-lg hover:bg-white/5 ${showLogs ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-white'}`} 
            title="Kernel Log"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button onClick={() => setSettingsOpen(true)} className="p-2.5 text-slate-500 hover:text-white transition-all rounded-lg hover:bg-white/5" title="Settings">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col overflow-hidden relative pb-[80px]">
        <ChatWindow transcripts={transcripts} />
        <KernelLog isVisible={showLogs} logs={logs} totalTokens={totalTokens} onFlush={() => setLogs([])} />
        <InputBar 
          inputText={inputText} 
          setInputText={setInputText} 
          onSendText={handleSendText} 
          isListening={status === ConnectionStatus.CONNECTED} 
          onStartSession={startSession} 
          onStopSession={stopSession} 
          status={status} 
        />
      </main>
    </div>
  );
};

export default App;
