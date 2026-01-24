
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { ConnectionStatus, VoiceAssistant, VoiceAssistantCallbacks, AppSettings } from '../types';
import { decode, encode, decodeAudioData, float32ToInt16 } from '../utils/audioUtils';
import { COMMAND_DECLARATIONS, executeCommand } from './commands';

export class GeminiVoiceAssistant implements VoiceAssistant {
  private session: any = null;
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

      const sessionPromise = ai.live.connect({
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
            this.startMicStreaming(stream, sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            await this.handleServerMessage(message, sessionPromise);
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

      this.session = await sessionPromise;

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
      const int16Data = float32ToInt16(inputData);
      const base64 = encode(new Uint8Array(int16Data.buffer));
      
      sessionPromise.then(session => {
        if (this.session) {
          session.sendRealtimeInput({ 
            media: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
          });
        }
      }).catch(() => {});
    };
    
    source.connect(scriptProcessor);
    scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleServerMessage(message: LiveServerMessage, sessionPromise: Promise<any>) {
    // Track tokens/usage
    const serverContent = message.serverContent as any;
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
        try {
          const response = await executeCommand(fc.name, fc.args, {
            onLog: (m, t, d) => this.callbacks.onLog(m, t, d),
            onSystem: (t, d) => this.callbacks.onSystemMessage(t, d),
            onFileState: (folder, note) => {
              this.currentFolder = folder;
              this.currentNote = note;
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
  }

  sendText(text: string): void {
    if (this.session) {
      const encoded = encode(new TextEncoder().encode(text));
      this.session.sendRealtimeInput({ media: { data: encoded, mimeType: 'text/plain' } });
    }
  }
}
