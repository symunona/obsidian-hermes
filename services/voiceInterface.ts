
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { ConnectionStatus, VoiceAssistant, VoiceAssistantCallbacks, AppSettings, UsageMetadata } from '../types';
import { decode, encode, decodeAudioData, float32ToInt16 } from '../utils/audioUtils';
import { COMMAND_DECLARATIONS, executeCommand } from './commands';

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

  constructor(private callbacks: VoiceAssistantCallbacks) {}

  async start(
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
            console.error('Gemini Voice Error:', err);
            const errorMsg = err.message || 'Quantum Link Error';
            this.callbacks.onLog(`NETWORK ERROR: ${errorMsg}`, 'error');
            this.stop();
            this.callbacks.onStatusChange(ConnectionStatus.ERROR);
          },
          onclose: (e: any) => {
            this.callbacks.onLog(`Uplink Closed: ${e.reason || 'Normal shutdown'}`, 'info');
            this.stop();
          }
        },
      });

      this.session = await this.sessionPromise;

    } catch (err: any) {
      this.callbacks.onStatusChange(ConnectionStatus.ERROR);
      this.callbacks.onLog(`Link Initialization Failed: ${err.message}`, 'error');
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
        session.sendRealtimeInput({ 
          media: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
        });
      }).catch(() => {});
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
        try {
          const response = await executeCommand(fc.name, fc.args, {
            onLog: (m, t, d) => this.callbacks.onLog(m, t, d),
            onSystem: (t, d) => this.callbacks.onSystemMessage(t, d),
            onFileState: (folder, note) => {
              this.currentFolder = folder;
              this.currentNote = Array.isArray(note) ? note[note.length - 1] : note;
              this.callbacks.onFileStateChange(folder, note);
            }
          });
          
          sessionPromise.then(s => s.sendToolResponse({ 
            functionResponses: { id: fc.id, name: fc.name, response: { result: response } } 
          }));
        } catch (err: any) {
          sessionPromise.then(s => s.sendToolResponse({ 
            functionResponses: { id: fc.id, name: fc.name, response: { error: err.message } } 
          }));
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
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ media: { data: encoded, mimeType: 'text/plain' } });
      });
    }
  }
}
