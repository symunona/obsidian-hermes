
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LogEntry, TranscriptionEntry, ConnectionStatus, ToolData, UsageMetadata } from './types';
import { initFileSystem, listDirectory, createFile } from './services/mockFiles';
import { saveAppSettings, loadAppSettings, isObsidianMode } from './services/persistence';
import { GeminiVoiceAssistant } from './services/voiceInterface';
import { DEFAULT_SYSTEM_INSTRUCTION } from './utils/defaultPrompt';

// Components
import Header from './components/Header';
import Settings from './components/Settings';
import KernelLog from './components/KernelLog';
import ChatWindow from './components/ChatWindow';
import InputBar from './components/InputBar';

const App: React.FC = () => {
  const saved = useMemo(() => {
    const data = loadAppSettings();
    return data || {};
  }, []);

  useEffect(() => {
    // Check if there's a saved conversation
    const data = loadAppSettings();
    setHasSavedConversation(!!data?.transcripts && data.transcripts.length > 0);
  }, []);

  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [inputText, setInputText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'user' | 'model' | 'none'>('none');
  const [micVolume, setMicVolume] = useState(0);
  
  const [transcripts, setTranscripts] = useState<TranscriptionEntry[]>([]);
  const [hasSavedConversation, setHasSavedConversation] = useState<boolean>(false);
  const [voiceName, setVoiceName] = useState<string>(() => saved.voiceName || 'Zephyr');
  const [customContext, setCustomContext] = useState<string>(() => saved.customContext || '');
  const [systemInstruction, setSystemInstruction] = useState<string>(() => saved.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION);
  const [manualApiKey, setManualApiKey] = useState<string>(() => saved.manualApiKey || '');
  const [currentFolder, setCurrentFolder] = useState<string>(() => saved.currentFolder || '/');
  const [currentNote, setCurrentNote] = useState<string | null>(() => saved.currentNote || null);
  const [totalTokens, setTotalTokens] = useState<number>(() => saved.totalTokens || 0);
  const [usage, setUsage] = useState<UsageMetadata>({ totalTokenCount: saved.totalTokens || 0 });
  const [fileCount, setFileCount] = useState<number>(0);

  const assistantRef = useRef<GeminiVoiceAssistant | null>(null);

  const isObsidian = useMemo(() => {
    return isObsidianMode();
  }, []);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', duration?: number) => {
    setLogs(prev => [...prev, { 
      id: Math.random().toString(36).substr(2, 9), 
      message, 
      timestamp: new Date(), 
      type,
      duration
    }]);
  }, []);

  const restoreConversation = () => {
    const data = loadAppSettings();
    if (data?.transcripts) {
      setTranscripts(data.transcripts);
      setHasSavedConversation(false);
      addLog('Previous conversation restored', 'info');
    }
  };

  const archiveConversation = useCallback(async (summary: string, history: TranscriptionEntry[]) => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
    const safeTopic = summary.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 40);
    const filename = `chat-history-${timestamp}-${safeTopic}.md`;

    const filteredHistory = history.filter(t => {
      if (t.id === 'welcome-init') return false;
      if (t.role === 'model' && t.text.trim().toLowerCase().replace(/\./g, '') === 'done') return false;
      return true;
    });

    const markdown = filteredHistory
      .map((t, i, arr) => {
        let block = '';
        if (t.role === 'user') {
          block = `**User**: ${t.text}`;
        } else if (t.role === 'model') {
          block = `> ${t.text.split('\n').join('\n> ')}`;
        } else if (t.role === 'system') {
          if (t.toolData?.name === 'rename_file') {
            block = `**RENAME** ~~${t.toolData.oldContent}~~ -> [[${t.toolData.newContent}]]`;
          } else if (t.toolData?.name === 'topic_switch') {
            block = `## ${t.toolData.newContent}`;
          } else {
            let output = `\`\`\`system\n${t.text}\n\`\`\``;
            if (t.toolData) {
              const fileRef = `[[${t.toolData.filename}]]`;
              if (t.toolData.oldContent !== undefined && t.toolData.newContent !== undefined && t.toolData.oldContent !== t.toolData.newContent) {
                output += `\n\n${fileRef}\n\n--- Removed\n\`\`\`markdown\n${t.toolData.oldContent || '(empty)'}\n\`\`\`\n\n+++ Added\n\`\`\`markdown\n${t.toolData.newContent || '(empty)'}\n\`\`\``;
              } else if (t.toolData.name === 'read_file' || t.toolData.name === 'create_file') {
                 output += `\n\n${fileRef}\n\`\`\`markdown\n${t.toolData.newContent}\n\`\`\``;
              }
            }
            block = output;
          }
        }
        const next = arr[i + 1];
        const isUserGroup = t.role === 'user' && next?.role === 'user';
        return block + (isUserGroup ? '\n\n' : '\n\n---\n\n');
      })
      .join('');

    try {
      await createFile(filename, `# Conversation Archive: ${summary}\n\n${markdown}`);
      addLog(`Segment archived to ${filename}`, 'action');
    } catch (err: any) {
      addLog(`Persistence Failure: ${err.message}`, 'error');
    }
  }, [addLog]);

  useEffect(() => {
    const lastMsg = transcripts[transcripts.length - 1];
    if (lastMsg?.role === 'system' && lastMsg.toolData?.name === 'topic_switch') {
      const summary = lastMsg.toolData.newContent || 'Shift';
      const toArchive = transcripts.slice(0, -1);
      if (toArchive.length > 0) {
        archiveConversation(summary, toArchive);
      }
    }
  }, [transcripts, archiveConversation]);

  useEffect(() => {
    initFileSystem().then(() => {
      const files = listDirectory();
      setFileCount(files.length);
      addLog(`HERMES_OS: Modules online.`, 'info');
      if (transcripts.length === 0) {
        setTranscripts([{
          id: 'welcome-init',
          role: 'system',
          text: 'HERMES OS INITIALIZED.',
          isComplete: true,
          timestamp: Date.now()
        }]);
      }
    });
  }, [addLog]);

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
        addLog('UPLINK ESTABLISHED.', 'info');
      } else if (s === ConnectionStatus.DISCONNECTED) {
        setActiveSpeaker('none');
        setMicVolume(0);
      }
    },
    onLog: (m: string, t: LogEntry['type'], d?: number) => addLog(m, t, d),
    onTranscription: (role: 'user' | 'model', text: string, isComplete: boolean) => {
      setActiveSpeaker(isComplete ? 'none' : role);
      setTranscripts(prev => {
        const activeIdx = prev.reduceRight((acc, e, i) => (acc !== -1 ? acc : (e.role === role && !e.isComplete ? i : -1)), -1);
        if (activeIdx !== -1) {
          const updated = [...prev];
          updated[activeIdx] = { ...updated[activeIdx], text: text || updated[activeIdx].text, isComplete };
          return updated;
        }
        return [...prev, { id: Math.random().toString(36).substr(2, 9), role, text, isComplete, timestamp: Date.now() }];
      });
    },
    onSystemMessage: (text: string, toolData?: ToolData) => {
      setTranscripts(prev => {
        if (toolData?.id) {
          const existingIdx = prev.findIndex(t => t.toolData?.id === toolData.id);
          if (existingIdx !== -1) {
            const next = [...prev];
            next[existingIdx] = {
              ...next[existingIdx],
              text,
              toolData: { ...next[existingIdx].toolData, ...toolData, status: toolData.status || 'success' }
            };
            return next;
          }
        }
        return [...prev, { id: 'sys-' + Date.now(), role: 'system', text, isComplete: true, toolData, timestamp: Date.now() }];
      });
      setFileCount(listDirectory().length);
    },
    onInterrupted: () => { setActiveSpeaker('none'); setMicVolume(0); },
    onFileStateChange: (folder: string, note: string | string[] | null) => { 
      setCurrentFolder(folder);
      const notes = Array.isArray(note) ? note : (note ? [note] : []);
      if (notes.length > 0) {
        setCurrentNote(notes[notes.length - 1]);
        if (isObsidian) {
          notes.forEach(async (path) => {
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath(path);
            if (file) {
              // @ts-ignore
              const leaf = app.workspace.getLeaf('tab');
              await leaf.openFile(file);
            }
          });
        }
      }
    },
    onUsageUpdate: (usage: UsageMetadata) => { 
      setUsage(usage);
      const tokens = usage.totalTokenCount;
      if (tokens !== undefined) setTotalTokens(tokens); 
    },
    onVolume: (volume: number) => setMicVolume(volume)
  }), [addLog, isObsidian]);

  const startSession = async () => {
    try {
      const activeKey = manualApiKey.trim() || process.env.API_KEY || '';
      if (!activeKey) {
        // @ts-ignore
        if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) await window.aistudio.openSelectKey();
      }
      assistantRef.current = new GeminiVoiceAssistant(assistantCallbacks);
      await assistantRef.current.start(activeKey, { voiceName, customContext, systemInstruction }, { folder: currentFolder, note: currentNote });
    } catch (err: any) {
      addLog(`Uplink Error: ${err.message}`, 'error');
      setStatus(ConnectionStatus.ERROR);
    }
  };

  const stopSession = () => {
    if (assistantRef.current) {
      assistantRef.current.stop();
      assistantRef.current = null;
      setActiveSpeaker('none');
      setMicVolume(0);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault(); 
    if (inputText.trim()) { 
      assistantCallbacks.onTranscription('user', inputText, true); 
      assistantRef.current?.sendText(inputText); 
      setInputText(''); 
    }
  };

  return (
    <div className={`hermes-root h-screen flex flex-col selection:bg-blue-500/30 overflow-hidden font-sans ${isObsidian ? '' : 'standalone'}`}>
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
        onUpdateApiKey={() => (window as any).aistudio?.openSelectKey()} 
      />
      
      <Header 
        status={status}
        showLogs={showLogs}
        onToggleLogs={() => setShowLogs(!showLogs)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      
      <main className="flex-grow flex flex-col overflow-hidden relative pb-[80px]">
        <ChatWindow 
          transcripts={transcripts} 
          hasSavedConversation={hasSavedConversation}
          onRestoreConversation={restoreConversation}
        />
        <KernelLog isVisible={showLogs} logs={logs} usage={usage} onFlush={() => setLogs([])} fileCount={fileCount} />
        <InputBar 
          inputText={inputText} 
          setInputText={setInputText} 
          onSendText={handleSendText} 
          isListening={status === ConnectionStatus.CONNECTED} 
          onStartSession={startSession} 
          onStopSession={stopSession} 
          status={status} 
          activeSpeaker={activeSpeaker} 
          volume={micVolume}
        />
      </main>
    </div>
  );
};

export default App;
