import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { LogEntry, TranscriptionEntry, ConnectionStatus, ToolData, UsageMetadata, AppSettings, ImageSearchResult } from './types';
import { Content } from '@google/genai';
import { initFileSystem, listDirectory } from './services/vaultOperations';
import { saveAppSettings, loadAppSettings, saveChatHistory, loadChatHistory, reloadAppSettings } from './persistence/persistence';
import { GeminiVoiceAssistant } from './services/voiceInterface';
import { GeminiTextInterface } from './services/textInterface';
import { DEFAULT_SYSTEM_INSTRUCTION } from './utils/defaultPrompt';
import { isObsidian } from './utils/environment';
import { executeCommand } from './services/commands';
import { persistConversationHistory, PersistenceOptions } from './utils/historyPersistence';
import { getErrorMessage } from './utils/getErrorMessage';

// Components
import Header from './components/Header';
import Settings from './components/Settings';
import MainWindow from './components/MainWindow';
import InputBar from './components/InputBar';
import ApiKeySetup from './components/ApiKeySetup';
import History from './components/History';

export interface AppHandle {
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  toggleSession: () => Promise<void>;
}

const getErrorStack = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.stack;
  return undefined;
};

const App = forwardRef<AppHandle, Record<string, never>>((_, ref) => {
  const saved = useMemo(() => {
    const data = loadAppSettings();
    return data ?? {};
  }, []);

  useEffect(() => {
    // Check if there's a saved conversation
    const chatHistory = loadChatHistory();
    setHasSavedConversation(!!chatHistory && chatHistory.length > 0);
  }, []);

  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [inputText, setInputText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showKernel, setShowKernel] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'user' | 'model' | 'none'>('none');
  const [micVolume, setMicVolume] = useState(0);
  
  const [transcripts, setTranscripts] = useState<TranscriptionEntry[]>([]);
  const transcriptsRef = useRef<TranscriptionEntry[]>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);
  
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
  
  // Topic ID for grouping messages - generated on init and on topic_switch
  const [currentTopicId, setCurrentTopicId] = useState<string>(() => `topic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const currentTopicIdRef = useRef<string>(currentTopicId);
  
  // Keep topicId ref in sync
  useEffect(() => {
    currentTopicIdRef.current = currentTopicId;
  }, [currentTopicId]);

  // Watermarks for context sync between voice and text interfaces
  const [lastVoiceSyncIndex, setLastVoiceSyncIndex] = useState<number>(0);
  const [lastTextSyncIndex, setLastTextSyncIndex] = useState<number>(0);
  
  // Refs for use in callbacks (avoid stale closures)
  const lastVoiceSyncIndexRef = useRef<number>(0);
  const lastTextSyncIndexRef = useRef<number>(0);
  
  // Keep watermark refs in sync
  useEffect(() => {
    lastVoiceSyncIndexRef.current = lastVoiceSyncIndex;
  }, [lastVoiceSyncIndex]);
  
  useEffect(() => {
    lastTextSyncIndexRef.current = lastTextSyncIndex;
  }, [lastTextSyncIndex]);

  const assistantRef = useRef<GeminiVoiceAssistant | null>(null);
  const textInterfaceRef = useRef<GeminiTextInterface | null>(null);

  const isObsidianEnvironment = useMemo(() => {
    return isObsidian();
  }, []);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', duration?: number, errorDetails?: LogEntry['errorDetails']) => {
    setLogs(prev => [...prev, { 
      id: Math.random().toString(36).slice(2, 11), 
      message, 
      timestamp: new Date(), 
      type,
      duration,
      errorDetails
    }]);
  }, []);

  // Helper functions for context sync
  const addModeMarker = (mode: 'voice' | 'text') => {
    const marker: TranscriptionEntry = {
      id: `mode-${Date.now()}`,
      role: 'system',
      text: mode === 'voice' 
        ? 'Voice interface activated' 
        : 'Text interface activated',
      isComplete: true,
      timestamp: Date.now(),
      topicId: currentTopicIdRef.current,
      toolData: {
        name: 'mode_switch',
        filename: '',
        status: 'success'
      }
    };
    setTranscripts(prev => [...prev, marker]);
  };

  const computeDelta = (fromIndex: number): TranscriptionEntry[] => {
    return transcriptsRef.current.slice(fromIndex).filter(t => 
      t.role !== 'system' || // Include user/model messages
      t.toolData?.name === 'mode_switch' // Include mode switches for context
    );
  };

  const formatDeltaForInjection = (delta: TranscriptionEntry[]): string => {
    if (delta.length === 0) return '';
    
    // Format as a single line with clear separators, avoiding newlines and special chars
    const messages = delta.map(t => {
      const role = t.role === 'user' ? 'User' : t.role === 'model' ? 'Assistant' : 'System';
      // Clean the text to remove newlines and problematic characters
      const cleanText = t.text.replace(/[\n\r\t]/g, ' ').replace(/[^\w\s.,!?;:'"-]/g, '');
      return `${role}: ${cleanText}`;
    });
    
    return `Previous conversation (${delta.length} messages): ${messages.join(' | ')}`;
  };

  const transcriptsToContents = (transcripts: TranscriptionEntry[]): Content[] => {
    return transcripts
      .filter(t => t.role === 'user' || t.role === 'model')
      .map(t => ({
        role: t.role as 'user' | 'model',
        parts: [{ text: t.text }]
      }));
  };

  const restoreConversation = (conversation?: TranscriptionEntry[]) => {
    if (conversation) {
      // Restore from archived conversation
      setTranscripts(conversation);
      setHasSavedConversation(false);
      addLog('Archived conversation restored', 'info');
      setHistoryOpen(false); // Close history panel after restore
    } else {
      // Restore from chat history (original functionality)
      const chatHistory = loadChatHistory();
      if (chatHistory && chatHistory.length > 0) {
        // Convert chat history to transcript format
        const transcriptHistory: TranscriptionEntry[] = chatHistory.map((message, index) => ({
          id: `chat-${index}`,
          role: 'user' as const,
          text: message,
          isComplete: true,
          timestamp: Date.now() - (chatHistory.length - index) * 1000,
          topicId: currentTopicIdRef.current
        }));
        setTranscripts(transcriptHistory);
        setHasSavedConversation(false);
        addLog('Chat history restored', 'info');
      }
    }
  };

  const resetConversation = () => {
    setTranscripts([{
      id: 'welcome-init',
      role: 'system',
      text: 'HERMES INITIALIZED.',
      isComplete: true,
      timestamp: Date.now(),
      topicId: currentTopicIdRef.current
    }]);
    setHasSavedConversation(false);
    addLog('Conversation reset', 'info');
  };

  useEffect(() => {
    const lastMsg = transcripts[transcripts.length - 1];
    if (lastMsg?.role === 'system' && lastMsg.toolData?.name === 'topic_switch') {
      console.warn('[HISTORY] EVENT: topic_switch detected - Topic switch triggered');
      
      // Get the OLD topicId before we switch (from the topic_switch message itself or current)
      const oldTopicId = lastMsg.topicId || currentTopicIdRef.current;
      
      // Generate NEW topicId for subsequent messages
      const newTopicId = `topic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setCurrentTopicId(newTopicId);
      console.warn(`[HISTORY] Topic switch: ${oldTopicId} -> ${newTopicId}`);
      
      // Filter messages belonging to the OLD topic only
      const transcriptsToArchive = transcripts.filter(t => 
        t.id !== 'welcome-init' && 
        t.id !== lastMsg.id && 
        t.topicId === oldTopicId
      );
      
      // Get current settings to access chatHistoryFolder
      const currentSettings = loadAppSettings();
      const chatHistoryFolder = currentSettings?.chatHistoryFolder || 'chat-history';
      
      // Prepare options for the persistence pipeline
      const options: PersistenceOptions = {
        transcripts: transcriptsToArchive,
        chatHistoryFolder,
        textInterface: textInterfaceRef.current,
        topicId: oldTopicId
      };
      
      // Use the same unified pipeline as end_conversation
      persistConversationHistory(options)
        .then(result => {
          if (result.success) {
            if (result.skipped) {
              addLog(result.message, 'info');
            } else {
              addLog(result.message, 'action');
              // Add system marker for conversation boundary instead of clearing
              setTranscripts(prev => [...prev, {
                id: `archived-${Date.now()}`,
                role: 'system',
                text: `📁 Topic switch - conversation archived: ${result.message}`,
                timestamp: Date.now(),
                isComplete: true,
                topicId: newTopicId  // Use NEW topicId for archive marker
              }]);
            }
          } else {
            const errorDetails = {
              toolName: 'persistConversationHistory',
              content: `History length: ${transcriptsToArchive.length} entries`,
              contentSize: JSON.stringify(transcriptsToArchive).length,
              stack: result.error,
              apiCall: 'archiveConversation'
            };
            addLog(`Persistence Failure: ${result.message}`, 'error', undefined, errorDetails);
          }
        })
        .catch(error => {
          const errorMsg = getErrorMessage(error);
          const errorDetails = {
            toolName: 'persistConversationHistory',
            content: `History length: ${transcriptsToArchive.length} entries`,
            contentSize: JSON.stringify(transcriptsToArchive).length,
            stack: errorMsg,
            apiCall: 'archiveConversation'
          };
          addLog(`Persistence Failure: ${errorMsg}`, 'error', undefined, errorDetails);
        });
    }
  }, [transcripts, addLog]);

  useEffect(() => {
    void (async () => {
      try {
        await initFileSystem();
        const files = listDirectory();
        setFileCount(files.length);
        addLog('HERMES_OS: Modules online.', 'info');
        
        // Check if we have chat history to restore
        const chatHistory = loadChatHistory();
        if (transcripts.length === 0 && (!chatHistory || chatHistory.length === 0)) {
          setTranscripts([{
            id: 'welcome-init',
            role: 'system',
            text: 'HERMES INITIALIZED.',
            isComplete: true,
            timestamp: Date.now(),
            topicId: currentTopicIdRef.current
          }]);
        }
      } catch (error) {
        addLog(`Initialization failed: ${getErrorMessage(error)}`, 'error');
      }
    })();
  }, [addLog]);

  useEffect(() => {
    void saveAppSettings({
      voiceName,
      customContext,
      systemInstruction,
      manualApiKey,
      serperApiKey,
      currentFolder,
      currentNote,
      totalTokens
    });
  }, [voiceName, customContext, systemInstruction, manualApiKey, serperApiKey, currentFolder, currentNote, totalTokens]);

  // Check API key and show setup screen if needed
  useEffect(() => {
    const activeKey = (manualApiKey || '').trim();
    const shouldShowSetup = !activeKey;
    setShowApiKeySetup(shouldShowSetup);
  }, [manualApiKey]);

  // Hook into settings updates from Obsidian
  useEffect(() => {
    const checkSettingsUpdate = () => {
      void (async () => {
        const reloadedSettings = await reloadAppSettings();
        if (reloadedSettings) {
          setVoiceName(reloadedSettings.voiceName || 'Zephyr');
          setCustomContext(reloadedSettings.customContext || '');
          setSystemInstruction(reloadedSettings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION);
          setManualApiKey(reloadedSettings.manualApiKey || '');
          setSerperApiKey(reloadedSettings.serperApiKey || '');
          
          // Check if API key was added
          const activeKey = (reloadedSettings.manualApiKey || '').trim();
          if (activeKey && showApiKeySetup) {
            setShowApiKeySetup(false);
            addLog('API key configured successfully', 'success');
          }
        }
      })();
    };

    // Listen for direct settings updates from Obsidian
    const handleSettingsUpdate = (settings: AppSettings) => {
      setVoiceName(settings.voiceName || 'Zephyr');
      setCustomContext(settings.customContext || '');
      setSystemInstruction(settings.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION);
      setManualApiKey(settings.manualApiKey || '');
      setSerperApiKey(settings.serperApiKey || '');
      
      // Check if API key was added
      const activeKey = (settings.manualApiKey || '').trim();
      if (activeKey && showApiKeySetup) {
        setShowApiKeySetup(false);
        addLog('API key configured successfully', 'success');
      }
    };

    // Register global handler
    window.hermesSettingsUpdate = handleSettingsUpdate;

    // Check settings updates periodically
    const interval = setInterval(checkSettingsUpdate, 2000);
    
    return () => {
      clearInterval(interval);
      // Clean up global handler
      delete window.hermesSettingsUpdate;
    };
  }, [showApiKeySetup, addLog]);

  const toggleSession = async () => {
    if (status === ConnectionStatus.CONNECTED) {
        stopSession();
    } else {
        await startSession();
    }
  };

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
    // Use ref to get latest transcripts (avoids stale closure issue)
    const currentTranscripts = transcriptsRef.current;
    
    console.warn('[HISTORY] EVENT: end_conversation - Session ending (archiveCurrentConversation)');
    
    // Get current settings to access chatHistoryFolder
    const currentSettings = loadAppSettings();
    const chatHistoryFolder = currentSettings?.chatHistoryFolder || 'chat-history';
    
    // Prepare options for the persistence pipeline
    const options: PersistenceOptions = {
      transcripts: currentTranscripts,
      chatHistoryFolder,
      textInterface: textInterfaceRef.current
    };
    
    try {
      const result = await persistConversationHistory(options);
      
      if (result.success) {
        if (result.skipped) {
          addLog(result.message, 'info');
        } else {
          addLog(result.message, 'action');
          // Add system marker for conversation boundary instead of clearing
          setTranscripts(prev => [...prev, {
            id: `archived-${Date.now()}`,
            role: 'system',
            text: `📁 Conversation archived: ${result.message}`,
            timestamp: Date.now(),
            isComplete: true,
            topicId: currentTopicIdRef.current
          }]);
        }
      } else {
        const errorDetails = {
          toolName: 'persistConversationHistory',
          content: `History length: ${currentTranscripts.length} entries`,
          contentSize: JSON.stringify(currentTranscripts).length,
          stack: result.error,
          apiCall: 'archiveConversation'
        };
        addLog(`Persistence Failure: ${result.message}`, 'error', undefined, errorDetails);
      }
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      const errorDetails = {
        toolName: 'persistConversationHistory',
        content: `History length: ${currentTranscripts.length} entries`,
        contentSize: JSON.stringify(currentTranscripts).length,
        stack: errorMsg,
        apiCall: 'archiveConversation'
      };
      addLog(`Persistence Failure: ${errorMsg}`, 'error', undefined, errorDetails);
    }
  }, [addLog]);

  // Note: Archive is now handled in voiceInterface.stop() to avoid race conditions
  // The previous useEffect that watched for DISCONNECTED status was causing duplicate saves

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
      return [...prev, { id: 'sys-' + Date.now(), role: 'system', text, isComplete: true, toolData, timestamp: Date.now(), topicId: currentTopicIdRef.current }];
    });
    setFileCount(listDirectory().length);
  }, []);

  const handleImageDownload = useCallback(async (image: ImageSearchResult, index: number) => {
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
        const newEntry = { id: Math.random().toString(36).slice(2, 11), role, text, isComplete, timestamp: Date.now(), topicId: currentTopicIdRef.current };
        return [...prev, newEntry];
      });
    },
    onSystemMessage: handleSystemMessage,
    onInterrupted: () => { setActiveSpeaker('none'); setMicVolume(0); },
    onFileStateChange: (folder: string, note: string | string[] | null) => { 
      setCurrentFolder(folder);
      const notes = Array.isArray(note) ? note : (note ? [note] : []);
      if (notes.length > 0) {
        setCurrentNote(notes[notes.length - 1]);
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

  // Initialize text interface when API key is available (for text mode)
  useEffect(() => {
    const activeKey = manualApiKey.trim();
    if (activeKey && !textInterfaceRef.current) {
      textInterfaceRef.current = new GeminiTextInterface({
        onLog: (m, t, d, e) => addLog(m, t, d, e),
        onTranscription: (role, text, isComplete) => {
          setTranscripts(prev => {
            const activeIdx = prev.reduceRight((acc, e, i) => (acc !== -1 ? acc : (e.role === role && !e.isComplete ? i : -1)), -1);
            if (activeIdx !== -1) {
              const updated = [...prev];
              updated[activeIdx] = { ...updated[activeIdx], text: text || updated[activeIdx].text, isComplete };
              
              // Save completed user messages to chat history
              if (role === 'user' && isComplete && text.trim()) {
                const currentHistory = loadChatHistory();
                const updatedHistory = [...currentHistory, text];
                void saveChatHistory(updatedHistory);
              }
              
              return updated;
            }
            const newEntry = { id: Math.random().toString(36).slice(2, 11), role, text, isComplete, timestamp: Date.now(), topicId: currentTopicIdRef.current };
            
            // Save completed user messages to chat history
            if (role === 'user' && isComplete && text.trim()) {
              const currentHistory = loadChatHistory();
              const updatedHistory = [...currentHistory, text];
              void saveChatHistory(updatedHistory);
            }
            
            return [...prev, newEntry];
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
        onUsageUpdate: (usage: UsageMetadata) => { 
          setUsage(usage);
          const tokens = usage.totalTokenCount;
          if (tokens !== undefined) setTotalTokens(tokens); 
        },
        onArchiveConversation: archiveCurrentConversation
      });
      
      textInterfaceRef.current.initialize(activeKey, { voiceName, customContext, systemInstruction }, { folder: currentFolder, note: currentNote });
    }
  }, [manualApiKey, voiceName, customContext, systemInstruction, currentFolder, currentNote, addLog, handleSystemMessage, archiveCurrentConversation]);

  const startSession = async () => {
    try {
      console.warn('[HISTORY] EVENT: start_conversation - Session started');
      
      const activeKey = manualApiKey.trim();
      if (!activeKey) {
        setShowApiKeySetup(true);
        return;
      }
      if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
      }
      
      // Add mode marker
      addModeMarker('voice');
      
      // Compute delta since last voice sync for context injection via system prompt
      const delta = computeDelta(lastVoiceSyncIndexRef.current);
      const conversationHistory = delta.length > 0 ? formatDeltaForInjection(delta) : undefined;
      
      if (conversationHistory) {
        addLog(`[CONTEXT SYNC] Including ${delta.length} messages in voice session system prompt (${conversationHistory.length} chars)`, 'info');
      }
      
      // Create and start voice session with conversation history in system prompt
      assistantRef.current = new GeminiVoiceAssistant(assistantCallbacks);
      await assistantRef.current.start(
        activeKey, 
        { voiceName, customContext, systemInstruction }, 
        { folder: currentFolder, note: currentNote },
        conversationHistory
      );
      
      // Update watermark
      setLastVoiceSyncIndex(transcriptsRef.current.length);
      lastVoiceSyncIndexRef.current = transcriptsRef.current.length;
    } catch (err) {
      const errorDetails = {
        toolName: 'GeminiVoiceAssistant',
        content: `Voice Name: ${voiceName}\nCustom Context: ${customContext}\nSystem Instruction: ${systemInstruction}`,
        contentSize: voiceName.length + customContext.length + systemInstruction.length,
        stack: getErrorStack(err),
        apiCall: 'startSession'
      };
      addLog(`Uplink Error: ${getErrorMessage(err)}`, 'error', undefined, errorDetails);
      setStatus(ConnectionStatus.ERROR);
    }
  };

  const stopSession = () => {
    if (assistantRef.current) {
      // Archive is now handled inside voiceInterface.stop()
      assistantRef.current.stop();
      assistantRef.current = null;
      setActiveSpeaker('none');
      setMicVolume(0);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!inputText.trim()) return;
    
    const message = inputText.trim();
    setInputText('');
    
    // Text input is disabled while voice is active (handled in InputBar)
    // If somehow we get here while voice is active, just ignore
    if (status === ConnectionStatus.CONNECTED && assistantRef.current) {
      addLog('[CONTEXT SYNC] Text input ignored - voice session active', 'info');
      return;
    }
    
    // Voice was not active - add mode marker and sync to text interface
    addModeMarker('text');
    
    // Use text interface
    const activeKey = manualApiKey.trim();
    if (!activeKey) {
      setShowApiKeySetup(true);
      return;
    }
    
    // Initialize text interface if not already done
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
            return [...prev, { id: Math.random().toString(36).slice(2, 11), role, text, isComplete, timestamp: Date.now(), topicId: currentTopicIdRef.current }];
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
        onUsageUpdate: (usage: UsageMetadata) => {
          setUsage(usage);
          if (usage.totalTokenCount !== undefined) setTotalTokens(usage.totalTokenCount);
        },
        onArchiveConversation: archiveCurrentConversation
      });
      
      textInterfaceRef.current.initialize(activeKey, { voiceName, customContext, systemInstruction }, { folder: currentFolder, note: currentNote });
    }
    
    // Sync delta to text interface
    const delta = computeDelta(lastTextSyncIndexRef.current);
    if (delta.length > 0 && textInterfaceRef.current) {
      const contents = transcriptsToContents(delta);
      addLog(`[CONTEXT SYNC] Injecting ${delta.length} messages to text interface`, 'info');
      
      try {
        textInterfaceRef.current.injectHistory(contents);
        addLog('[CONTEXT SYNC] Successfully injected context to text interface', 'info');
      } catch (injectErr) {
        addLog(`[CONTEXT SYNC] Failed to inject context to text: ${getErrorMessage(injectErr)}`, 'error');
        console.error('[CONTEXT SYNC] Text injection failed:', injectErr, 'Contents were:', contents);
      }
    }
    
    // Update watermark
    setLastTextSyncIndex(transcriptsRef.current.length);
    lastTextSyncIndexRef.current = transcriptsRef.current.length;
    
    // Send message
    textInterfaceRef.current.sendMessage(message);
  };

  const handleApiKeySave = (apiKey: string) => {
    setManualApiKey(apiKey);
    addLog('API key saved successfully', 'success');
    setShowApiKeySetup(false);
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
            onUpdateApiKey={() => (window as { aistudio?: { openSelectKey?: () => void } }).aistudio?.openSelectKey()}
          />
          
          <Header 
            status={status}
            showLogs={showKernel}
            onToggleLogs={() => setShowKernel(!showKernel)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenHistory={() => setHistoryOpen(!historyOpen)}
            isListening={status === ConnectionStatus.CONNECTED}
            onStopSession={stopSession}
            onResetConversation={resetConversation}
            transcripts={transcripts}
          />
          
          {historyOpen ? (
            <History isActive={true} onRestoreConversation={restoreConversation} />
          ) : (
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
          )}
          
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
