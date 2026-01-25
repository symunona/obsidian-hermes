
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

      // VERBOSE LOGGING: Log system instruction and context sizes
      console.log('=== SYSTEM INSTRUCTION DEBUG ===');
      console.log('Base System Instruction Length:', settings.systemInstruction.length);
      console.log('Context String Length:', contextString.length);
      console.log('Custom Context Length:', settings.customContext.length);
      console.log('Final System Instruction Length:', systemInstruction.length);
      console.log('Current Folder:', this.currentFolder);
      console.log('Current Note:', this.currentNote);
      console.log('Settings Voice Name:', settings.voiceName);
      console.log('Full System Instruction (first 500 chars):', systemInstruction.substring(0, 500));
      console.log('Full System Instruction (last 500 chars):', systemInstruction.substring(Math.max(0, systemInstruction.length - 500)));
      console.log('=== END SYSTEM INSTRUCTION DEBUG ===');
      
      this.callbacks.onLog(`System instruction size: ${systemInstruction.length} chars`, 'info');

      // VERBOSE LOGGING: Log session configuration before connecting
      console.log('=== SESSION CONFIG DEBUG ===');
      console.log('Model:', 'gemini-2.5-flash-native-audio-preview-12-2025');
      console.log('Response Modalities:', [Modality.AUDIO]);
      console.log('System Instruction Length:', systemInstruction.length);
      console.log('Voice Name:', settings.voiceName);
      console.log('Tool Declarations Count:', COMMAND_DECLARATIONS.length);
      console.log('Tool Declaration Names:', COMMAND_DECLARATIONS.map(t => t.name));
      console.log('=== END SESSION CONFIG DEBUG ===');
      
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
            console.error('=== GEMINI LIVE CONNECTION ERROR ===');
            console.error('Error Type:', err.constructor.name);
            console.error('Error Message:', err.message);
            console.error('Error Code:', err.code);
            console.error('Error Status:', err.status);
            console.error('Error Details:', err.details);
            console.error('Request Size:', err.requestSize);
            console.error('Response Size:', err.responseSize);
            console.error('Timestamp:', new Date().toISOString());
            console.error('Stack:', err.stack);
            console.error('=== END GEMINI LIVE CONNECTION ERROR ===');
            
            console.error('Gemini Voice Error:', err);
            const errorMsg = err.message || 'Quantum Link Error';
            const errorDetails = {
              toolName: 'GeminiVoiceAssistant',
              apiCall: 'live.connect',
              stack: err.stack,
              content: JSON.stringify(err, null, 2),
              requestSize: err.requestSize,
              responseSize: err.responseSize,
              errorCode: err.code,
              errorStatus: err.status,
              errorDetails: err.details,
              timestamp: new Date().toISOString()
            };
            this.callbacks.onLog(`NETWORK ERROR: ${errorMsg}`, 'error', undefined, errorDetails);
            
            // Show error as system message in chat
            this.callbacks.onSystemMessage(`ERROR: ${errorMsg}`, {
              id: 'error-' + Date.now(),
              name: 'error',
              filename: '',
              status: 'error',
              error: errorMsg
            });
            
            // Attempt recovery with retry logic
            if (this.retryCounter.canRetry) {
              this.callbacks.onLog(`Connection error, attempting recovery...`, 'info');
              this.callbacks.onSystemMessage(`Connection error, attempting recovery...`);
              
              setTimeout(async () => {
                try {
                  this.stop();
                  await this.performStart(this.storedApiKey, this.storedSettings!, this.storedInitialState);
                } catch (retryErr) {
                  this.callbacks.onLog(`Recovery failed: ${retryErr.message}`, 'error');
                  this.callbacks.onSystemMessage(`Recovery failed: ${retryErr.message}`);
                }
              }, 1000);
            } else {
              this.callbacks.onLog(`could not recover!`, 'error');
              this.callbacks.onSystemMessage(`could not recover!`);
            }
            
            this.stop();
            this.callbacks.onStatusChange(ConnectionStatus.ERROR);
          },
          onclose: (e: any) => {
            const reason = e.reason || e.code || 'Connection dropped';
            const isError = e.code !== 1000 && e.code !== 1001; // 1000=normal, 1001=going away
            
            if (isError) {
              console.error(e)
              console.error('=== VOICE CONNECTION CLOSED ===');
              console.error('Close Code:', e.code);
              console.error('Close Reason:', e.reason);
              console.error('Timestamp:', new Date().toISOString());
              console.error('=== END VOICE CONNECTION CLOSED ===');
              
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
      console.error(err)
      // Verbose console logging
      console.error('=== VOICE INTERFACE ERROR ===')
      console.error('API Call:', 'start');
      console.error('Timestamp:', new Date().toISOString());
      console.error('Audio Context State:', this.inputAudioContext?.state);
      console.error('Output Audio Context State:', this.outputAudioContext?.state);
      console.error('=== END VOICE INTERFACE ERROR ===');
      
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
        
        // VERBOSE LOGGING: Log audio streaming details
        if (audioDataSize > 50000) { // Only log large chunks to avoid spam
          console.log('=== AUDIO STREAMING DEBUG ===');
          console.log('Audio Data Size (bytes):', audioDataSize);
          console.log('Audio MIME Type:', 'audio/pcm;rate=16000');
          console.log('Timestamp:', new Date().toISOString());
          console.log('Session State:', session ? 'active' : 'null');
          console.log('=== END AUDIO STREAMING DEBUG ===');
        }
        
        session.sendRealtimeInput({ 
          media: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
        });
      }).catch((err) => {
        console.error('=== AUDIO STREAMING ERROR ===');
        console.error('Audio Send Error:', err);
        console.error('Audio Data Size:', base64.length);
        console.error('Timestamp:', new Date().toISOString());
        console.error('=== END AUDIO STREAMING ERROR ===');
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
        const actionName = fc.name.replace(/_/g, ' ').toUpperCase();
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
            }
          }, toolCallId);  // Pass the toolCallId to executeCommand
          
          sessionPromise.then(s => {
            // VERBOSE LOGGING: Log tool response details
            const responseData = JSON.stringify({ result: response });
            console.log('=== TOOL RESPONSE DEBUG ===');
            console.log('Tool Name:', fc.name);
            console.log('Tool Call ID:', fc.id);
            console.log('Response Size:', responseData.length);
            console.log('Response Type:', typeof response);
            console.log('Timestamp:', new Date().toISOString());
            console.log('=== END TOOL RESPONSE DEBUG ===');
            
            // Only update the message if the tool didn't already do it
            if (!toolUpdatedMessage) {
              this.callbacks.onSystemMessage(`${actionName} Complete`, {
                id: toolCallId,
                name: fc.name,
                filename: (fc.args?.filename as string) || (fc.name === 'internet_search' ? 'Web' : 'Registry'),
                status: 'success',
                newContent: response?.text || (typeof response === 'string' ? response : JSON.stringify(response, null, 2)),
                groundingChunks: response?.groundingChunks || [],
                files: response?.files || response?.directories?.map((d: any) => d.path) || response?.folders,
                directoryInfo: response?.directoryInfo
              });
            }
            
            s.sendToolResponse({ 
              functionResponses: { id: fc.id, name: fc.name, response: { result: response } } 
            });
          });
        } catch (err: any) {
          // Verbose console logging
          console.error(err)
          console.error('=== VOICE INTERFACE TOOL ERROR ===')
          console.error('Tool Name:', fc.name);
          console.error('Tool Arguments:', fc.args);
          console.error('Error Type:', err.constructor.name);
          console.error('Error Message:', err.message);
          console.error('Error Stack:', err.stack);
          console.error('Timestamp:', new Date().toISOString());
          console.error('=== END VOICE INTERFACE TOOL ERROR ===');

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
            // VERBOSE LOGGING: Log tool error response
            console.log('=== TOOL ERROR RESPONSE DEBUG ===');
            console.log('Tool Name:', fc.name);
            console.log('Tool Call ID:', fc.id);
            console.log('Error Message:', err.message);
            console.log('Timestamp:', new Date().toISOString());
            console.log('=== END TOOL ERROR RESPONSE DEBUG ===');
            
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
      
      // VERBOSE LOGGING: Log text input details
      console.log('=== TEXT INPUT DEBUG ===');
      console.log('Text Length:', text.length);
      console.log('Encoded Size:', encoded.length);
      console.log('Text Preview (first 100 chars):', text.substring(0, 100));
      console.log('Timestamp:', new Date().toISOString());
      console.log('=== END TEXT INPUT DEBUG ===');
      
      this.callbacks.onLog(`Sending text input: ${text.length} chars`, 'info');
      
      this.sessionPromise.then(session => {
        try {
          session.sendRealtimeInput({ media: { data: encoded, mimeType: 'text/plain' } });
          console.log('Text input sent successfully');
        } catch (err: any) {
          console.error('=== TEXT INPUT ERROR ===');
          console.error('Text Send Error:', err);
          console.error('Text Length:', text.length);
          console.error('Encoded Size:', encoded.length);
          console.error('Error Type:', err.constructor.name);
          console.error('Timestamp:', new Date().toISOString());
          console.error('=== END TEXT INPUT ERROR ===');
          
          this.callbacks.onLog(`Text input failed: ${err.message}`, 'error');
        }
      }).catch((err) => {
        console.error('=== SESSION PROMISE ERROR (TEXT) ===');
        console.error('Session Promise Error:', err);
        console.error('Timestamp:', new Date().toISOString());
        console.error('=== END SESSION PROMISE ERROR (TEXT) ===');
      });
    }
  }
}
