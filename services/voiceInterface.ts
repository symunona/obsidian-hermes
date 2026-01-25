
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { ConnectionStatus, VoiceAssistant, VoiceAssistantCallbacks, AppSettings, UsageMetadata } from '../types';
import { decode, encode, decodeAudioData, float32ToInt16 } from '../utils/audioUtils';
import { COMMAND_DECLARATIONS, executeCommand } from './commands';
import { withRetry, RetryCounter } from '../utils/retryUtils';

export class GeminiVoiceAssistant implements VoiceAssistant {
  private session: any = null;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();
  
  private currentInputText = '';
  private currentOutputText = '';
  
  private currentFolder = '/';
  private currentNote: string | null = null;
  private retryCounter = new RetryCounter(2);
  private storedApiKey: string = '';
  private storedSettings: AppSettings | null = null;
  private storedInitialState: { folder: string, note: string | null } | undefined;

  constructor(private callbacks: VoiceAssistantCallbacks) {}

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
        onRetry: (attempt, error) => {
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
      
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.nextStartTime = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const contextString = `
CURRENT_CONTEXT:
Current Folder Path: ${this.currentFolder}
Current Note Name: ${this.currentNote || 'No note currently selected'}
`;
      const systemInstruction = `${settings.systemInstruction}\n${contextString}\n\n${settings.customContext}`.trim();

      // System instruction debug summary
      console.log(`System instruction: ${systemInstruction.length} chars, folder: ${this.currentFolder}, note: ${this.currentNote}`);
      
      this.callbacks.onLog(`System instruction size: ${systemInstruction.length} chars`, 'info');

      // Session configuration debug summary
      console.log(`Session config: model=gemini-2.5-flash-native-audio-preview-12-2025, tools=${COMMAND_DECLARATIONS.length}, voice=${settings.voiceName}`);
      
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
            if (this.sessionPromise) {
              this.startMicStreaming(stream, this.sessionPromise);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (this.sessionPromise) {
              await this.handleServerMessage(message, this.sessionPromise);
            }
          },
          onerror: (err: any) => {
            console.error(`Gemini connection error: ${err.message} (${err.constructor.name})`);
            this.callbacks.onLog(`Connection error: ${err.message}`, 'error');
            this.callbacks.onStatusChange(ConnectionStatus.ERROR);
            this.callbacks.onSystemMessage(`Connection Error: ${err.message}`);
          },
          onclose: (e: any) => {
            const reason = e.reason || e.code || 'Connection dropped';
            const isError = e.code !== 1000 && e.code !== 1001; // 1000=normal, 1001=going away
            
            if (isError) {
              console.error(`Voice connection closed: code=${e.code}, reason=${reason}`);
              
              const errorDetails = {
                toolName: 'GeminiVoiceAssistant',
                apiCall: 'live.connect',
                content: `Code: ${e.code}, Reason: ${reason}`,
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
      });

      this.session = await this.sessionPromise;

    } catch (err: any) {
      this.callbacks.onStatusChange(ConnectionStatus.ERROR);
      console.error(`Voice interface error: ${err.message}`);
      
      const errorDetails = {
        toolName: 'GeminiVoiceAssistant',
        apiCall: 'start',
        stack: err.stack,
        content: err.message,
        requestSize: err.requestSize,
        responseSize: err.responseSize,
        userAgent: navigator.userAgent,
        audioContextState: this.inputAudioContext?.state,
        timestamp: new Date().toISOString()
      };
      this.callbacks.onLog(`Link Initialization Failed: ${err.message}`, 'error', undefined, errorDetails);
      
      // Show error as system message in chat
      this.callbacks.onSystemMessage(`ERROR: ${err.message}`, {
        id: 'error-' + Date.now(),
        name: 'error',
        filename: '',
        status: 'error',
        error: err.message
      });
      
      throw err;
    }
  }

  private startMicStreaming(stream: MediaStream, sessionPromise: Promise<any>) {
    if (!this.inputAudioContext) return;
    
    const source = this.inputAudioContext.createMediaStreamSource(stream);
    const scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    scriptProcessor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      
      // Calculate volume for UI
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.callbacks.onVolume(rms);

      const int16Data = float32ToInt16(inputData);
      const base64 = encode(new Uint8Array(int16Data.buffer));
      
      // CRITICAL: Solely rely on sessionPromise resolves and then call `session.sendRealtimeInput`, do not add other condition checks.
      sessionPromise.then(session => {
        const audioDataSize = base64.length;
        
        // Audio streaming debug summary (large chunks only)
        if (audioDataSize > 50000) {
          console.log(`Audio streaming: ${audioDataSize} bytes, session active`);
        }
        
        session.sendRealtimeInput({ 
          media: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
        });
      }).catch((err) => {
        console.error(`Audio streaming error: ${err.message}, data size: ${base64.length}`);
      });
    };
    
    source.connect(scriptProcessor);
    scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleServerMessage(message: LiveServerMessage, sessionPromise: Promise<any>) {
    // Fix: Using type cast to access usageMetadata which might not be in the official type definition yet
    const serverContent = message.serverContent as any;
    if (serverContent?.usageMetadata) {
      this.callbacks.onUsageUpdate(serverContent.usageMetadata as UsageMetadata);
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
        // Create a pending system message first
        const toolCallId = `tool-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        
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
        
        this.callbacks.onSystemMessage(`${actionName}...`, {
          id: toolCallId,
          name: fc.name,
          filename: (fc.args?.filename as string) || (fc.name === 'internet_search' ? 'Web' : 'Registry'),
          status: 'pending'
        });
        
        try {
          const response = await executeCommand(fc.name, fc.args, {
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
          }, toolCallId);  // Pass the toolCallId to executeCommand
          
          sessionPromise.then(s => {
            // Tool response debug summary
            const responseData = JSON.stringify({ result: response });
            console.log(`Tool response: ${fc.name}, size: ${responseData.length} chars`);
            
            // Only update the message if the tool didn't already do it
            if (!toolUpdatedMessage) {
              // For create operations, show containing folder instead of JSON status
              let displayContent = '';
              if (fc.name === 'create_file' || fc.name === 'create_directory') {
                const path = fc.args?.filename || fc.args?.path;
                if (path && typeof path === 'string') {
                  // Extract directory from path
                  const lastSlashIndex = path.lastIndexOf('/');
                  const containingFolder = lastSlashIndex === -1 ? '/' : path.substring(0, lastSlashIndex + 1);
                  displayContent = `Created in: ${containingFolder}`;
                }
              } else if (fc.name === 'move_file' || fc.name === 'rename_file') {
                displayContent = `Moved from: ${fc.args?.sourcePath || fc.args?.oldPath} to: ${fc.args?.targetPath || fc.args?.newPath}`;
              } else if (fc.name === 'update_file' || fc.name === 'edit_file') {
                displayContent = `Updated: ${fc.args?.filename}`;
              } else if (fc.name === 'delete_file') {
                displayContent = `Deleted: ${fc.args?.filename}`;
              } else if (response?.text) {
                displayContent = response.text;
              } else if (typeof response === 'string') {
                displayContent = response;
              }
              // Don't show JSON for other tool types - let the tool's own onSystem call handle display
              
              // Only send completion message if we have display content
              if (displayContent) {
                this.callbacks.onSystemMessage(`${actionName} Complete`, {
                  id: toolCallId,
                  name: fc.name,
                  filename: (fc.args?.filename as string) || (fc.name === 'internet_search' ? 'Web' : 'Registry'),
                  status: 'success',
                  newContent: displayContent,
                  groundingChunks: response?.groundingChunks || [],
                  files: response?.files || response?.directories?.map((d: any) => d.path) || response?.folders,
                  directoryInfo: response?.directoryInfo
                });
              }
            }
            
            s.sendToolResponse({ 
              functionResponses: { id: fc.id, name: fc.name, response: { result: response } } 
            });
          });
        } catch (err: any) {
          console.error(err);
          console.error(`Voice interface tool error: ${fc.name} - ${err.message}`);

          const errorDetails = {
            toolName: fc.name,
            content: JSON.stringify(fc.args, null, 2),
            contentSize: JSON.stringify(fc.args).length,
            stack: err.stack,
            apiCall: 'executeCommand',
            timestamp: new Date().toISOString(),
            currentFolder: this.currentFolder,
            currentNote: this.currentNote
          };
          this.callbacks.onLog(`Tool execution error in ${fc.name}: ${err.message}`, 'error', undefined, errorDetails);
          
          // Update the existing message to error status
          this.callbacks.onSystemMessage(`ERROR in ${fc.name}: ${err.message}`, {
            id: toolCallId,
            name: fc.name,
            filename: (fc.args?.filename as string) || (fc.name === 'internet_search' ? 'Web' : 'Registry'),
            status: 'error',
            error: err.message
          });
          
          sessionPromise.then(s => {
            // Tool error response summary
            console.log(`Tool error response: ${fc.name} - ${err.message}`);
            
            s.sendToolResponse({ 
              functionResponses: { id: fc.id, name: fc.name, response: { error: err.message } } 
            });
          });
        }
      }
    }

    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      const audioBuffer = await decodeAudioData(decode(base64Audio), this.outputAudioContext, 24000, 1);
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
      this.sources.forEach(s => { try { s.stop(); } catch (e) {} });
      this.sources.clear();
      this.nextStartTime = 0;
      this.callbacks.onInterrupted();
    }
  }

  stop(): void {
    if (this.session) {
      try { this.session.close(); } catch (e) {}
      this.session = null;
    }
    this.sessionPromise = null;
    
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    
    if (this.outputAudioContext) {
      this.outputAudioContext.close();
      this.outputAudioContext = null;
    }
    
    this.sources.forEach(s => { try { s.stop(); } catch (e) {} });
    this.sources.clear();
    
    this.currentInputText = '';
    this.currentOutputText = '';
    this.callbacks.onStatusChange(ConnectionStatus.DISCONNECTED);
    this.callbacks.onVolume(0);
  }

  sendText(text: string): void {
    if (this.sessionPromise) {
      const encoded = encode(new TextEncoder().encode(text));
      
      // Text input debug summary
      console.log(`Text input: ${text.length} chars, encoded: ${encoded.length} bytes`);
      
      this.callbacks.onLog(`Sending text input: ${text.length} chars`, 'info');
      
      this.sessionPromise.then(session => {
        try {
          session.sendRealtimeInput({ media: { data: encoded, mimeType: 'text/plain' } });
          console.log('Text input sent successfully');
        } catch (err: any) {
          console.error(`Text input error: ${err.message}, text length: ${text.length}`);
          this.callbacks.onLog(`Text input failed: ${err.message}`, 'error');
        }
      }).catch((err) => {
        console.error(`Session promise error (text): ${err.message}`);
      });
    }
  }
}
