
import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { LogEntry, TranscriptionEntry, ConnectionStatus, ToolData, UsageMetadata } from './types';
import { initFileSystem, listDirectory } from './services/mockFiles';
import { saveAppSettings, loadAppSettings, saveChatHistory, loadChatHistory, reloadAppSettings } from './persistence/persistence';
import { GeminiVoiceAssistant } from './services/voiceInterface';
import { GeminiTextInterface } from './services/textInterface';
import { DEFAULT_SYSTEM_INSTRUCTION } from './utils/defaultPrompt';
import { isObsidian } from './utils/environment';
import { archiveConversation } from './utils/archiveConversation';
import { executeCommand } from './services/commands';

// Components
import Header from './components/Header';
import Settings from './components/Settings';
import MainWindow from './components/MainWindow';
import InputBar from './components/InputBar';
import ApiKeySetup from './components/ApiKeySetup';

const App = forwardRef<any, {}>((props, ref) => {
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
  const [showKernel, setShowKernel] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'user' | 'model' | 'none'>('none');
  const [micVolume, setMicVolume] = useState(0);
  
  const [transcripts, setTranscripts] = useState<TranscriptionEntry[]>([]);
  const [hasSavedConversation, setHasSavedConversation] = useState<boolean>(false);
  const [voiceName, setVoiceName] = useState<string>(() => saved.voiceName || 'Zephyr');
  const [customContext, setCustomContext] = useState<string>(() => saved.customContext || '');
  const [systemInstruction, setSystemInstruction] = useState<string>(() => saved.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION);
  const [manualApiKey, setManualApiKey] = useState<string>(() => saved.manualApiKey || '');
  const [serperApiKey, setSerperApiKey] = useState<string>(() => saved.serperApiKey || '');
  const [currentFolder, setCurrentFolder] = useState<string>(() => saved.currentFolder || '/');
  const [currentNote, setCurrentNote] = useState<string | null>(() => saved.currentNote || null);
  const [totalTokens, setTotalTokens] = useState<number>(() => saved.totalTokens || 0);
  const [usage, setUsage] = useState<UsageMetadata>({ totalTokenCount: saved.totalTokens || 0 });
  const [fileCount, setFileCount] = useState<number>(0);
  const [showApiKeySetup, setShowApiKeySetup] = useState<boolean>(false);

  const assistantRef = useRef<GeminiVoiceAssistant | null>(null);
  const textInterfaceRef = useRef<GeminiTextInterface | null>(null);

  const isObsidianEnvironment = useMemo(() => {
    return isObsidian();
  }, []);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', duration?: number, errorDetails?: LogEntry['errorDetails']) => {
    setLogs(prev => [...prev, { 
      id: Math.random().toString(36).substr(2, 9), 
      message, 
      timestamp: new Date(), 
      type,
      duration,
      errorDetails
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

  const handleMissingApiKey = async () => {
    // First, reload plugin settings to get the latest API key
    addLog('Reloading plugin settings...', 'info');
    const reloadedSettings = await reloadAppSettings();
    
    // Update the manualApiKey state with the reloaded value
    if (reloadedSettings?.manualApiKey) {
      setManualApiKey(reloadedSettings.manualApiKey);
    }
    
    // Check if API key is still missing after reload
    const activeKey = (reloadedSettings?.manualApiKey || manualApiKey).trim() || process.env.API_KEY || '';
    if (!activeKey) {
      // Post message in chat about missing API key
      setTranscripts(prev => [...prev, { 
        id: 'api-key-missing-' + Date.now(), 
        role: 'system', 
        text: 'API KEY MISSING - Please configure your API key in Settings to continue.', 
        isComplete: true, 
        timestamp: Date.now() 
      }]);
      
      // Open settings
      setSettingsOpen(true);
      addLog('API key missing after settings reload - opening Settings', 'error');
    } else {
      addLog('API key found after settings reload', 'success');
    }
  };


  useEffect(() => {
    const lastMsg = transcripts[transcripts.length - 1];
    if (lastMsg?.role === 'system' && lastMsg.toolData?.name === 'topic_switch') {
      const summary = lastMsg.toolData.newContent || 'Shift';
      const toArchive = transcripts.filter(t => t.id !== 'welcome-init' && t.id !== lastMsg.id);
      if (toArchive.length > 0) {
        // Get current settings to access chatHistoryFolder
        const currentSettings = loadAppSettings();
        const chatHistoryFolder = currentSettings?.chatHistoryFolder || 'chat-history';
        
        archiveConversation(summary, toArchive, chatHistoryFolder, textInterfaceRef.current)
          .then(message => addLog(message, 'action'))
          .catch(err => {
            const errorDetails = {
              toolName: 'archiveConversation',
              content: `Summary: ${summary}\nHistory length: ${toArchive.length} entries`,
              contentSize: summary.length + JSON.stringify(toArchive).length,
              stack: err.message,
              apiCall: 'createFile'
            };
            addLog(`Persistence Failure: ${err.message}`, 'error', undefined, errorDetails);
          });
      }
    }
  }, [transcripts, addLog]);

  useEffect(() => {
    initFileSystem().then(() => {
      const files = listDirectory();
      setFileCount(files.length);
      addLog(`HERMES_OS: Modules online.`, 'info');
      if (transcripts.length === 0) {
        setTranscripts([{
          id: 'welcome-init',
          role: 'system',
          text: 'HERMES INITIALIZED.',
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
      serperApiKey,
      currentFolder,
      currentNote,
      totalTokens
    });
  }, [transcripts, voiceName, customContext, systemInstruction, manualApiKey, serperApiKey, currentFolder, currentNote, totalTokens]);

  // Check API key and show setup screen if needed
  useEffect(() => {
    const activeKey = (manualApiKey || '').trim() || process.env.API_KEY || '';
    const shouldShowSetup = !activeKey;
    setShowApiKeySetup(shouldShowSetup);
  }, [manualApiKey]);

  // Hook into settings updates from Obsidian
  useEffect(() => {
    const checkSettingsUpdate = async () => {
      const reloadedSettings = await reloadAppSettings();
      if (reloadedSettings) {
        setVoiceName(reloadedSettings.voiceName || 'Zephyr');
        setCustomContext(reloadedSettings.customContext || '');
        setSystemInstruction(reloadedSettings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION);
        setManualApiKey(reloadedSettings.manualApiKey || '');
        setSerperApiKey(reloadedSettings.serperApiKey || '');
        
        // Check if API key was added
        const activeKey = (reloadedSettings.manualApiKey || '').trim() || process.env.API_KEY || '';
        if (activeKey && showApiKeySetup) {
          setShowApiKeySetup(false);
          addLog('API key configured successfully', 'success');
        }
      }
    };

    // Listen for direct settings updates from Obsidian
    const handleSettingsUpdate = (settings: any) => {
      setVoiceName(settings.voiceName || 'Zephyr');
      setCustomContext(settings.customContext || '');
      setSystemInstruction(settings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION);
      setManualApiKey(settings.manualApiKey || '');
      setSerperApiKey(settings.serperApiKey || '');
      
      // Check if API key was added
      const activeKey = (settings.manualApiKey || '').trim() || process.env.API_KEY || '';
      if (activeKey && showApiKeySetup) {
        setShowApiKeySetup(false);
        addLog('API key configured successfully', 'success');
      }
    };

    // Register global handler
    (window as any).hermesSettingsUpdate = handleSettingsUpdate;

    // Check settings updates periodically
    const interval = setInterval(checkSettingsUpdate, 2000);
    
    return () => {
      clearInterval(interval);
      // Clean up global handler
      delete (window as any).hermesSettingsUpdate;
    };
  }, [showApiKeySetup, addLog]);

  // Expose methods via ref for command palette access
  useImperativeHandle(ref, () => ({
    startSession,
    stopSession,
    toggleSession
  }));

  // Cleanup voice session on component unmount
  useEffect(() => {
    return () => {
      if (assistantRef.current) {
        assistantRef.current.stop();
        assistantRef.current = null;
        // Don't archive here as it's component unmount, not intentional conversation end
      }
    };
  }, []);

  const archiveCurrentConversation = useCallback(async () => {
    const toArchive = transcripts.filter(t => t.id !== 'welcome-init');
    if (toArchive.length > 0) {
      // Initialize summary with fallback value
      let summary = 'Conversation Ended';
      
      try {
        // Generate AI title from conversation content
        if (textInterfaceRef.current) {
          try {
            const conversationText = toArchive
              .filter(entry => entry.role === 'user' || entry.role === 'model')
              .map(entry => `${entry.role}: ${entry.text}`)
              .join('\n');
            
            if (conversationText.trim()) {
              // Request a short, keyword-rich title instead of a summary
              summary = await textInterfaceRef.current.generateSummary(
                `Please generate a short, keyword-rich title (2-4 words, max 30 characters) for this conversation. Focus on the main topic or task:\n\n${conversationText}`
              );
              
              // Clean up the AI response to get just the title
              summary = summary
                .replace(/^(title|subject|topic):?\s*/i, '') // Remove common prefixes
                .replace(/^["'`]|["'`]$/g, '') // Remove quotes
                .replace(/\.$/, '') // Remove trailing period
                .trim()
                .substring(0, 30); // Ensure it's short
              
              // Fallback if AI response is empty or too short
              if (!summary || summary.length < 2) {
                summary = 'Conversation Ended';
              }
            }
          } catch (error: any) {
            console.warn('Failed to generate AI title:', error.message);
            // Continue with fallback title
          }
        }
        
        // Get current settings to access chatHistoryFolder
        const currentSettings = loadAppSettings();
        const chatHistoryFolder = currentSettings?.chatHistoryFolder || 'chat-history';
        
        const message = await archiveConversation(summary, toArchive, chatHistoryFolder, textInterfaceRef.current);
        addLog(message, 'action');
        // Note: Conversation remains in UI after archiving - no reset
      } catch (err: any) {
        const errorDetails = {
          toolName: 'archiveConversation',
          content: `Summary: ${summary}\nHistory length: ${toArchive.length} entries`,
          contentSize: summary.length + JSON.stringify(toArchive).length,
          stack: err.message,
          apiCall: 'createFile'
        };
        addLog(`Persistence Failure: ${err.message}`, 'error', undefined, errorDetails);
      }
    }
  }, [transcripts, addLog]);

  // Archive conversation when voice session stops unexpectedly
  useEffect(() => {
    if (status === ConnectionStatus.DISCONNECTED && assistantRef.current === null && transcripts.length > 1) {
      // Only archive if there was an active conversation (more than just welcome message)
      const hasRealConversation = transcripts.some(t => t.role === 'user' || (t.role === 'model' && t.id !== 'welcome-init'));
      if (hasRealConversation) {
        archiveCurrentConversation();
      }
    }
  }, [status, assistantRef.current, transcripts, archiveCurrentConversation]);

  const handleSystemMessage = useCallback((text: string, toolData?: ToolData) => {
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
  }, []);

  const handleImageDownload = useCallback(async (image: any, index: number) => {
    try {
      const result = await executeCommand('download_image', {
        imageUrl: image.url,
        title: image.title,
        query: image.query || image.originalQuery || 'image',
        index: index + 1
      }, {
        onLog: () => {},
        onSystem: handleSystemMessage,
        onFileState: () => {}
      });
      
      return result;
    } catch (error) {
      console.error('Failed to download image:', error);
      throw error;
    }
  }, [handleSystemMessage]);

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
    onLog: (m: string, t: LogEntry['type'], d?: number, e?: LogEntry['errorDetails']) => addLog(m, t, d, e),
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
    onSystemMessage: handleSystemMessage,
    onInterrupted: () => { setActiveSpeaker('none'); setMicVolume(0); },
    onFileStateChange: (folder: string, note: string | string[] | null) => { 
      setCurrentFolder(folder);
      const notes = Array.isArray(note) ? note : (note ? [note] : []);
      if (notes.length > 0) {
        setCurrentNote(notes[notes.length - 1]);
        if (isObsidianEnvironment) {
          notes.forEach(async (path) => {
            // @ts-ignore
            const file = app.vault.getAbstractFileByPath(path);
            // if (file) {
            //   // @ts-ignore
            //   const leaf = app.workspace.getLeaf('tab');
            //   await leaf.openFile(file);
            // }
          });
        }
      }
    },
    onUsageUpdate: (usage: UsageMetadata) => { 
      setUsage(usage);
      const tokens = usage.totalTokenCount;
      if (tokens !== undefined) setTotalTokens(tokens); 
    },
    onVolume: (volume: number) => setMicVolume(volume),
    onArchiveConversation: archiveCurrentConversation
  }), [addLog, isObsidianEnvironment, handleSystemMessage, archiveCurrentConversation]);

  const startSession = async () => {
    try {
      const activeKey = manualApiKey.trim() || process.env.API_KEY || '';
      if (!activeKey) {
        setShowApiKeySetup(true);
        return;
      }
      // @ts-ignore
      if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) await window.aistudio.openSelectKey();
      
      assistantRef.current = new GeminiVoiceAssistant(assistantCallbacks);
      await assistantRef.current.start(activeKey, { voiceName, customContext, systemInstruction }, { folder: currentFolder, note: currentNote });
    } catch (err: any) {
      const errorDetails = {
        toolName: 'GeminiVoiceAssistant',
        content: `Voice Name: ${voiceName}\nCustom Context: ${customContext}\nSystem Instruction: ${systemInstruction}`,
        contentSize: voiceName.length + customContext.length + systemInstruction.length,
        stack: err.stack,
        apiCall: 'startSession'
      };
      addLog(`Uplink Error: ${err.message}`, 'error', undefined, errorDetails);
      setStatus(ConnectionStatus.ERROR);
    }
  };

  const stopSession = async () => {
    if (assistantRef.current) {
      assistantRef.current.stop();
      assistantRef.current = null;
      setActiveSpeaker('none');
      setMicVolume(0);
      
      // Archive conversation when session is manually stopped
      await archiveCurrentConversation();
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!inputText.trim()) return;
    
    const message = inputText.trim();
    setInputText('');
    
    // Save message to chat history
    const currentHistory = loadChatHistory();
    const updatedHistory = [...currentHistory, message];
    await saveChatHistory(updatedHistory);
    
    // If voice session is active, stop it first before using text API
    if (status === ConnectionStatus.CONNECTED && assistantRef.current) {
      assistantRef.current.stop();
      assistantRef.current = null;
      setActiveSpeaker('none');
      setMicVolume(0);
    }
    
    // Use text interface
    const activeKey = manualApiKey.trim() || process.env.API_KEY || '';
    if (!activeKey) {
      setShowApiKeySetup(true);
      return;
    }
    
    // Initialize text interface if needed
    if (!textInterfaceRef.current) {
      textInterfaceRef.current = new GeminiTextInterface({
        onLog: (m, t, d, e) => addLog(m, t, d, e),
        onTranscription: (role, text, isComplete) => {
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
        onSystemMessage: handleSystemMessage,
        onFileStateChange: (folder, note) => {
          setCurrentFolder(folder);
          const notes = Array.isArray(note) ? note : (note ? [note] : []);
          if (notes.length > 0) {
            setCurrentNote(notes[notes.length - 1]);
          }
        },
        onUsageUpdate: (usage) => {
          setUsage(usage);
          if (usage.totalTokenCount !== undefined) setTotalTokens(usage.totalTokenCount);
        },
        onArchiveConversation: archiveCurrentConversation
      });
      
      await textInterfaceRef.current.initialize(activeKey, { voiceName, customContext, systemInstruction }, { folder: currentFolder, note: currentNote });
    }
    
    await textInterfaceRef.current.sendMessage(message);
  };

  const toggleSession = async () => {
    if (status === ConnectionStatus.CONNECTED) {
        await stopSession();
    } else {
        await startSession();
    }
  };

  const handleApiKeySave = async (apiKey: string) => {
    setManualApiKey(apiKey);
    addLog('API key saved successfully', 'success');
    setShowApiKeySetup(false);
  };

  const handleOpenSettingsForApiKey = () => {
    setSettingsOpen(true);
  };

  return (
    <div className={`hermes-root flex flex-col overflow-hidden ${isObsidianEnvironment ? '' : 'standalone'}`}>
      {showApiKeySetup ? (
        <ApiKeySetup onApiKeySave={handleApiKeySave} />
      ) : (
        <>
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
            serperApiKey={serperApiKey}
            setSerperApiKey={setSerperApiKey}
            onUpdateApiKey={() => (window as any).aistudio?.openSelectKey()}
          />
          
          <Header 
            status={status}
            showLogs={showKernel}
            onToggleLogs={() => setShowKernel(!showKernel)}
            onOpenSettings={() => setSettingsOpen(true)}
            isListening={status === ConnectionStatus.CONNECTED}
            onStopSession={stopSession}
          />
          
          <MainWindow 
            showKernel={showKernel}
            transcripts={transcripts} 
            hasSavedConversation={hasSavedConversation}
            onRestoreConversation={restoreConversation}
            logs={logs}
            usage={usage}
            onFlushLogs={() => setLogs([])}
            fileCount={fileCount}
            onImageDownload={handleImageDownload}
          />
          
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
            hasApiKey={!showApiKeySetup}
          />
        </>
      )}
    </div>
  );
});

App.displayName = 'App';

export default App;
