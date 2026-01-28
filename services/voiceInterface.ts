
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Platform } from 'obsidian';
import { ConnectionStatus, VoiceAssistant, VoiceAssistantCallbacks, AppSettings, UsageMetadata } from '../types';
import { decode, encode, decodeAudioData, float32ToInt16 } from '../utils/audioUtils';
import { COMMAND_DECLARATIONS, executeCommand } from './commands';
import { withRetry, RetryCounter } from '../utils/retryUtils';

type LiveSession = {
  sendRealtimeInput: (payload: { media: { data: string | Uint8Array; mimeType: string } }) => void;
  sendToolResponse: (payload: { functionResponses: { id: string; name: string; response: { result?: unknown; error?: string } } }) => void;
  close: () => void;
};

type ToolArgs = Record<string, unknown>;

const getStringArg = (args: ToolArgs, key: string): string | undefined => {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const getErrorStack = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.stack;
  return undefined;
};

export class GeminiVoiceAssistant implements VoiceAssistant {
  private session: LiveSession | null = null;
  private sessionPromise: Promise<LiveSession> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();
  private inputWorkletNode: AudioWorkletNode | null = null;
  private inputWorkletGain: GainNode | null = null;
  private inputStream: MediaStream | null = null;
  
  private currentInputText = '';
  private currentOutputText = '';
  
  private currentFolder = '/';
  private currentNote: string | null = null;
  private retryCounter = new RetryCounter(2);
  private storedApiKey: string = '';
  private storedSettings: AppSettings | null = null;
  private storedInitialState: { folder: string; note: string | null } | undefined;

  private hasArchived = false;

  constructor(private callbacks: VoiceAssistantCallbacks) {}

  private async getSession(): Promise<LiveSession> {
    if (this.session) return this.session;
    if (this.sessionPromise === null) {
      throw new Error('Session not initialized');
    }
    this.session = await this.sessionPromise;
    return this.session;
  }

  async start(
    apiKey: string, 
    settings: AppSettings, 
    initialState?: { folder: string, note: string | null }
  ): Promise<void> {
    // Store parameters for retry
    this.storedApiKey = apiKey;
    this.storedSettings = settings;
    this.storedInitialState = initialState;
    this.retryCounter.reset();

    await withRetry(
      async () => {
        this.retryCounter.increment();
        await this.performStart(apiKey, settings, initialState);
      },
      {
        maxRetries: 2,
        delay: 1000,
        onRetry: (attempt, _error) => {
          this.callbacks.onLog(`Connection failed, retrying attempt ${attempt}/2...`, 'info');
          this.callbacks.onSystemMessage(`Connection failed, retrying attempt ${attempt}/2...`);
        }
      }
    );
  }

  private async performStart(
    apiKey: string, 
    settings: AppSettings, 
    initialState?: { folder: string, note: string | null }
  ): Promise<void> {
    try {
      if (initialState) {
        this.currentFolder = initialState.folder;
        this.currentNote = initialState.note;
      }

      this.callbacks.onStatusChange(ConnectionStatus.CONNECTING);
      this.callbacks.onLog('Negotiating Uplink...', 'info');
      
      const ai = new GoogleGenAI({ apiKey });
      
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext is not supported in this environment');
      }
      this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
      this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextStartTime = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.inputStream = stream;
      
      const contextString = `
CURRENT_CONTEXT:
Current Folder Path: ${this.currentFolder}
Current Note Name: ${this.currentNote || 'No note currently selected'}
`;
      const systemInstruction = `${settings.systemInstruction}\n${contextString}\n\n${settings.customContext}`.trim();

      // System instruction debug summary
      console.debug(`System instruction: ${systemInstruction.length} chars, folder: ${this.currentFolder}, note: ${this.currentNote}`);
      
      this.callbacks.onLog(`System instruction size: ${systemInstruction.length} chars`, 'info');

      // Session configuration debug summary
      console.debug(`Session config: model=gemini-2.5-flash-native-audio-preview-12-2025, tools=${COMMAND_DECLARATIONS.length}, voice=${settings.voiceName}`);
      
      this.callbacks.onLog('Initializing Gemini live connection...', 'info');
      
      // Initializing session promise to be used for all subsequent real-time inputs.
      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: settings.voiceName } 
            } 
          },
          tools: [{ functionDeclarations: COMMAND_DECLARATIONS }],
        },
        callbacks: {
          onopen: () => {
            this.callbacks.onStatusChange(ConnectionStatus.CONNECTED);
            this.callbacks.onLog('Uplink synchronized. Voice channel active.', 'info');
            if (this.sessionPromise !== null) {
              void this.startMicStreaming(stream);
            }
          },
          onmessage: (message: LiveServerMessage) => {
            void this.handleServerMessage(message);
          },
          onerror: (err: unknown) => {
            console.error(`Gemini connection error: ${getErrorMessage(err)}`);
            this.callbacks.onLog(`Connection error: ${getErrorMessage(err)}`, 'error');
            this.callbacks.onStatusChange(ConnectionStatus.ERROR);
            this.callbacks.onSystemMessage(`Connection error: ${getErrorMessage(err)}`);
          },
          onclose: (event: CloseEvent) => {
            const reason = event.reason || String(event.code) || 'Connection dropped';
            const isError = event.code !== 1000 && event.code !== 1001; // 1000=normal, 1001=going away
            
            if (isError) {
              console.error(`Voice connection closed: code=${event.code}, reason=${reason}`);
              
              const errorDetails = {
                toolName: 'GeminiVoiceAssistant',
                apiCall: 'live.connect',
                content: `Code: ${event.code}, Reason: ${reason}`,
                timestamp: new Date().toISOString()
              };
              this.callbacks.onLog(`CONNECTION DROPPED: ${reason}`, 'error', undefined, errorDetails);
              
              // Show error as system message in chat
              this.callbacks.onSystemMessage(`CONNECTION DROPPED: ${reason}`, {
                id: 'error-' + Date.now(),
                name: 'error',
                filename: '',
                status: 'error',
                error: reason
              });
            } else {
              this.callbacks.onLog(`Uplink Closed: ${reason}`, 'info');
            }
            
            this.stop();
          }
        },
      }) as Promise<LiveSession>;

      this.session = await this.sessionPromise;

    } catch (err) {
      this.callbacks.onStatusChange(ConnectionStatus.ERROR);
      console.error(`Voice interface error: ${getErrorMessage(err)}`);
      
      const errorDetails = {
        toolName: 'GeminiVoiceAssistant',
        apiCall: 'start',
        stack: getErrorStack(err),
        content: getErrorMessage(err),
        requestSize: (err as { requestSize?: number }).requestSize,
        responseSize: (err as { responseSize?: number }).responseSize,
        platform: {
          isMobileApp: Platform.isMobileApp,
          isDesktopApp: Platform.isDesktopApp,
          isMacOS: Platform.isMacOS,
          isWin: Platform.isWin,
          isLinux: Platform.isLinux
        },
        audioContextState: this.inputAudioContext?.state,
        timestamp: new Date().toISOString()
      };
      this.callbacks.onLog(`Link Initialization Failed: ${getErrorMessage(err)}`, 'error', undefined, errorDetails);
      
      // Show error as system message in chat
      this.callbacks.onSystemMessage(`Error: ${getErrorMessage(err)}`, {
        id: 'error-' + Date.now(),
        name: 'error',
        filename: '',
        status: 'error',
        error: getErrorMessage(err)
      });
      
      throw err;
    }
  }

  private async startMicStreaming(stream: MediaStream): Promise<void> {
    if (!this.inputAudioContext) return;

    const session = await this.getSession();
    const source = this.inputAudioContext.createMediaStreamSource(stream);

    const workletCode = `
      class HermesAudioProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0];
          if (input && input[0]) {
            this.port.postMessage(input[0]);
          }
          return true;
        }
      }
      registerProcessor('hermes-audio-processor', HermesAudioProcessor);
    `;

    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);
    try {
      await this.inputAudioContext.audioWorklet.addModule(workletUrl);
    } finally {
      URL.revokeObjectURL(workletUrl);
    }

    const workletNode = new AudioWorkletNode(this.inputAudioContext, 'hermes-audio-processor');
    this.inputWorkletNode = workletNode;
    const gain = this.inputAudioContext.createGain();
    gain.gain.value = 0;
    this.inputWorkletGain = gain;

    workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      const inputData = event.data;
      if (!inputData || inputData.length === 0) return;

      // Calculate volume for UI
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.callbacks.onVolume(rms);

      const int16Data = float32ToInt16(inputData);
      const base64 = encode(new Uint8Array(int16Data.buffer));
      const audioDataSize = base64.length;

      if (audioDataSize > 50000) {
        console.debug(`Audio streaming: ${audioDataSize} bytes, session active`);
      }

      try {
        session.sendRealtimeInput({
          media: { data: base64, mimeType: 'audio/pcm;rate=16000' }
        });
      } catch (error) {
        console.error(`Audio streaming error: ${getErrorMessage(error)}, data size: ${base64.length}`);
        // If the session is closing, don't treat this as a critical error
        if (getErrorMessage(error).includes('CLOSING') || getErrorMessage(error).includes('CLOSED')) {
          console.debug('Session is closing, stopping audio streaming');
          return;
        }
      }
    };

    source.connect(workletNode);
    workletNode.connect(gain);
    gain.connect(this.inputAudioContext.destination);
  }

  private async handleServerMessage(message: LiveServerMessage): Promise<void> {
    const serverContent = message.serverContent as { usageMetadata?: UsageMetadata } | undefined;
    if (serverContent?.usageMetadata) {
      this.callbacks.onUsageUpdate(serverContent.usageMetadata);
    }

    if (message.serverContent?.inputTranscription?.text) {
      this.currentInputText += message.serverContent.inputTranscription.text;
      this.callbacks.onTranscription('user', this.currentInputText, false);
    }
    
    if (message.serverContent?.outputTranscription) {
      this.currentOutputText += message.serverContent.outputTranscription.text;
      this.callbacks.onTranscription('model', this.currentOutputText, false);
    }
    
    if (message.serverContent?.turnComplete) {
      if (this.currentInputText) {
        this.callbacks.onTranscription('user', this.currentInputText, true);
        this.currentInputText = '';
      }
      if (this.currentOutputText) {
        this.callbacks.onTranscription('model', this.currentOutputText, true);
        this.currentOutputText = '';
      }
    }

    if (message.toolCall) {
      for (const fc of message.toolCall.functionCalls) {
        // Special handling for end_conversation - execute immediately without tool response
        if (fc.name === 'end_conversation') {
          console.debug('Processing end_conversation tool call');
          try {
            const _response = await executeCommand(fc.name, fc.args as ToolArgs, {
              onLog: (m, t, d) => this.callbacks.onLog(m, t, d),
              onSystem: (t, d) => this.callbacks.onSystemMessage(t, d),
              onFileState: (folder, note) => {
                this.currentFolder = folder;
                this.currentNote = Array.isArray(note) ? note[note.length - 1] : note;
                this.callbacks.onFileStateChange(folder, note);
              },
              onStopSession: () => {
                this.stop();
              },
              onArchiveConversation: this.callbacks.onArchiveConversation
            }, undefined, this.currentFolder);
            console.debug('end_conversation executed successfully, session ending');
            // Don't send tool response - the session is ending
            continue;
          } catch (err) {
            console.error(`end_conversation failed: ${getErrorMessage(err)}`);
            // Even if end_conversation fails, we should still stop the session
            this.stop();
            continue;
          }
        }

        // Create a pending system message first
        const toolCallId = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const args = isRecord(fc.args) ? (fc.args as ToolArgs) : {};
        
        // Map tool names to descriptive labels
        const toolLabels: { [key: string]: string } = {
          'generate_image_from_context': 'Image Generation',
          'create_file': 'File Creation',
          'delete_file': 'File Deletion',
          'edit_file': 'File Editing',
          'update_file': 'File Update',
          'move_file': 'File Move',
          'rename_file': 'File Rename',
          'create_directory': 'Directory Creation',
          'list_directory': 'Vault Scan',
          'list_vault_files': 'File Explorer',
          'dirlist': 'Directory Structure',
          'get_folder_tree': 'Folder Tree',
          'read_file': 'File Reading',
          'search_keyword': 'Keyword Search',
          'search_regexp': 'Pattern Search',
          'search_replace_file': 'File Search & Replace',
          'search_replace_global': 'Global Search & Replace',
          'internet_search': 'Web Search',
          'reveal_active_pane': 'Active Pane Info',
          'open_folder_in_system': 'System File Browser',
          'end_conversation': 'Session End',
          'topic_switch': 'Topic Switch'
        };
        
        const actionName = toolLabels[fc.name] || fc.name.replace(/_/g, ' ').toUpperCase();
        let toolUpdatedMessage = false;  // Track if tool already updated the message
        
        const filenameLabel = getStringArg(args, 'filename') || (fc.name === 'internet_search' ? 'Web' : 'Registry');
        this.callbacks.onSystemMessage(`${actionName}...`, {
          id: toolCallId,
          name: fc.name,
          filename: filenameLabel,
          status: 'pending'
        });
        
        try {
          const response = await executeCommand(fc.name, args, {
            onLog: (m, t, d) => this.callbacks.onLog(m, t, d),
            onSystem: (t, d) => {
              // Pass through to the main callback - the ID is already set by wrappedCallbacks in commands.ts
              this.callbacks.onSystemMessage(t, d);
              // Mark that the tool has updated the message (if it set status to success)
              if (d?.status === 'success') {
                toolUpdatedMessage = true;
              }
            },
            onFileState: (folder, note) => {
              this.currentFolder = folder;
              this.currentNote = Array.isArray(note) ? note[note.length - 1] : note;
              this.callbacks.onFileStateChange(folder, note);
            },
            onStopSession: () => {
              this.stop();
            },
            onArchiveConversation: this.callbacks.onArchiveConversation
          }, toolCallId, this.currentFolder);  // Pass the toolCallId and currentFolder to executeCommand

          const _session = await this.getSession();

          // Tool response debug summary
          const responseData = JSON.stringify({ result: response });
          console.debug(`Tool response: ${fc.name}, size: ${responseData.length} chars`);

          const responseRecord = isRecord(response) ? response : undefined;
          const responseText = responseRecord && typeof responseRecord.text === 'string' ? responseRecord.text : undefined;

          // Only update the message if the tool didn't already do it
          if (!toolUpdatedMessage) {
            // For create operations, show containing folder instead of JSON status
            let displayContent = '';
            if (fc.name === 'create_file' || fc.name === 'create_directory') {
              const path = getStringArg(args, 'filename') || getStringArg(args, 'path');
              if (path) {
                // Extract directory from path
                const lastSlashIndex = path.lastIndexOf('/');
                const containingFolder = lastSlashIndex === -1 ? '/' : path.substring(0, lastSlashIndex + 1);
                displayContent = `Created in: ${containingFolder}`;
              }
            } else if (fc.name === 'move_file' || fc.name === 'rename_file') {
              const sourcePath = getStringArg(args, 'sourcePath') || getStringArg(args, 'oldPath');
              const targetPath = getStringArg(args, 'targetPath') || getStringArg(args, 'newPath');
              if (sourcePath && targetPath) {
                displayContent = `Moved from: ${sourcePath} to: ${targetPath}`;
              }
            } else if (fc.name === 'update_file' || fc.name === 'edit_file') {
              const filename = getStringArg(args, 'filename');
              if (filename) {
                displayContent = `Updated: ${filename}`;
              }
            } else if (fc.name === 'delete_file') {
              const filename = getStringArg(args, 'filename');
              if (filename) {
                displayContent = `Deleted: ${filename}`;
              }
            } else if (responseText) {
              displayContent = responseText;
            } else if (typeof response === 'string') {
              displayContent = response;
            }

            // Only send completion message if we have display content
            if (displayContent) {
              const groundingChunks = Array.isArray(responseRecord?.groundingChunks) ? responseRecord?.groundingChunks : [];
              const responseFiles = Array.isArray(responseRecord?.files)
                ? responseRecord?.files.filter((file): file is string => typeof file === 'string')
                : undefined;
              const responseDirectories = Array.isArray(responseRecord?.directories)
                ? responseRecord?.directories
                    .map((dir) => (isRecord(dir) && typeof dir.path === 'string' ? dir.path : null))
                    .filter((path): path is string => Boolean(path))
                : undefined;
              const responseFolders = Array.isArray(responseRecord?.folders)
                ? responseRecord?.folders.filter((folder): folder is string => typeof folder === 'string')
                : undefined;
              const directoryInfo = Array.isArray(responseRecord?.directoryInfo) ? responseRecord?.directoryInfo : undefined;

              this.callbacks.onSystemMessage(`${actionName} Complete`, {
                id: toolCallId,
                name: fc.name,
                filename: filenameLabel,
                status: 'success',
                newContent: displayContent,
                groundingChunks,
                files: responseFiles || responseDirectories || responseFolders,
                directoryInfo
              });
            }
          }

          try {
            const session = await this.getSession();
            session.sendToolResponse({
              functionResponses: { id: fc.id, name: fc.name, response: { result: response } }
            });
          } catch (responseError) {
            console.error(`Failed to send tool response: ${getErrorMessage(responseError)}`);
            // Don't treat this as a critical error - the session may have been intentionally closed
            // by the tool itself (e.g., end_conversation)
          }
        } catch (err) {
          const errorMessage = getErrorMessage(err);
          console.error(`Voice interface tool error: ${fc.name} - ${errorMessage}`);

          const errorDetails = {
            toolName: fc.name,
            content: JSON.stringify(args, null, 2),
            contentSize: JSON.stringify(args).length,
            stack: getErrorStack(err),
            apiCall: 'executeCommand',
            timestamp: new Date().toISOString(),
            currentFolder: this.currentFolder,
            currentNote: this.currentNote
          };
          this.callbacks.onLog(`Tool execution error in ${fc.name}: ${errorMessage}`, 'error', undefined, errorDetails);

          // Update the existing message to error status
          this.callbacks.onSystemMessage(`Error in ${fc.name}: ${errorMessage}`, {
            id: toolCallId,
            name: fc.name,
            filename: filenameLabel,
            status: 'error',
            error: errorMessage
          });

          try {
            const session = await this.getSession();
            console.debug(`Tool error response: ${fc.name} - ${errorMessage}`);
            session.sendToolResponse({
              functionResponses: { id: fc.id, name: fc.name, response: { error: errorMessage } }
            });
          } catch (error) {
            console.error(`Failed to send tool error response: ${getErrorMessage(error)}`);
            // Don't treat this as a critical error - the session may have been intentionally closed
            // by the tool itself (e.g., end_conversation)
          }
        }
      }
    }

    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      const audioBuffer = decodeAudioData(decode(base64Audio), this.outputAudioContext, 24000, 1);
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioContext.destination);
      source.onended = () => this.sources.delete(source);
      
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.sources.add(source);
    }

    if (message.serverContent?.interrupted) {
      this.sources.forEach(source => {
        try {
          source.stop();
        } catch (error) {
          console.debug('Audio source stop failed', error);
        }
      });
      this.sources.clear();
      this.nextStartTime = 0;
      this.callbacks.onInterrupted();
    }
  }

  stop(): void {
    // [HISTORY-PERSIST] Archive conversation before stopping (only once)
    if (this.callbacks.onArchiveConversation && !this.hasArchived) {
      this.hasArchived = true;
      console.warn('[HISTORY] EVENT: end_conversation (voiceInterface.stop)');
      this.callbacks.onArchiveConversation().catch(err => {
        console.warn('[HISTORY] Archive failed:', err);
      });
    }
    
    if (this.session) {
      try {
        this.session.close();
      } catch (error) {
        console.debug('Session close failed', error);
      }
      this.session = null;
    }
    this.sessionPromise = null;
    
    if (this.inputWorkletNode) {
      this.inputWorkletNode.disconnect();
      this.inputWorkletNode = null;
    }

    if (this.inputWorkletGain) {
      this.inputWorkletGain.disconnect();
      this.inputWorkletGain = null;
    }

    if (this.inputStream) {
      this.inputStream.getTracks().forEach(track => track.stop());
      this.inputStream = null;
    }

    if (this.inputAudioContext) {
      void this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    
    if (this.outputAudioContext) {
      void this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
    
    this.sources.forEach(source => {
      try {
        source.stop();
      } catch (error) {
        console.debug('Output source stop failed', error);
      }
    });
    this.sources.clear();
    
    this.currentInputText = '';
    this.currentOutputText = '';
    this.callbacks.onStatusChange(ConnectionStatus.DISCONNECTED);
    this.callbacks.onVolume(0);
  }

  sendText(text: string): void {
    if (this.sessionPromise === null) return;

    const encoded = encode(new TextEncoder().encode(text));

    // Text input debug summary
    console.debug(`Text input: ${text.length} chars, encoded: ${encoded.length} bytes`);

    this.callbacks.onLog(`Sending text input: ${text.length} chars`, 'info');

    void (async () => {
      try {
        const session = await this.getSession();
        session.sendRealtimeInput({ media: { data: encoded, mimeType: 'text/plain' } });
        console.debug('Text input sent successfully');
      } catch (error) {
        console.error(`Text input error: ${getErrorMessage(error)}, text length: ${text.length}`);
        this.callbacks.onLog(`Text input failed: ${getErrorMessage(error)}`, 'error');
      }
    })();
  }
}
