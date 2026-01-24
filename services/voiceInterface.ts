
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
  
  // Tracking local state for the instruction injection
  private currentFolder = '/';
  private currentNote: string | null = null;

  constructor(private callbacks: VoiceAssistantCallbacks) {}

  async start(apiKey: string, settings: AppSettings): Promise<void> {
    try {
      this.callbacks.onStatusChange(ConnectionStatus.CONNECTING);
      this.callbacks.onLog('Initializing Gemini Live connection...', 'info');

      const ai = new GoogleGenAI({ apiKey });
      
      // Setup Audio
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.nextStartTime = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Inject current context into system instruction
      const contextString = `
CURRENT_CONTEXT:
Current Folder: ${this.currentFolder}
Current Note: ${this.currentNote || 'None'}
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
            this.callbacks.onLog('Voice link established.', 'info');
            this.startMicStreaming(stream, sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            await this.handleServerMessage(message, sessionPromise);
          },
          onerror: (err) => {
            console.error('Gemini Voice Error:', err);
            this.stop();
            this.callbacks.onStatusChange(ConnectionStatus.ERROR);
          },
          onclose: () => {
            this.stop();
          }
        },
      });

      this.session = await sessionPromise;

    } catch (err: any) {
      this.callbacks.onStatusChange(ConnectionStatus.ERROR);
      this.callbacks.onLog(`Failed to start assistant: ${err.message}`, 'error');
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
        session.sendRealtimeInput({ 
          media: { data: base64, mimeType: 'audio/pcm;rate=16000' } 
        });
      });
    };
    
    source.connect(scriptProcessor);
    scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async handleServerMessage(message: LiveServerMessage, sessionPromise: Promise<any>) {
    // 1. Handle Transcriptions
    if (message.serverContent?.inputTranscription?.text) {
      this.callbacks.onDiffUpdate(null);
      this.currentInputText += message.serverContent.inputTranscription.text;
      this.callbacks.onTranscription('user', this.currentInputText, false);
    }
    
    if (message.serverContent?.outputTranscription) {
      this.currentOutputText += message.serverContent.outputTranscription.text;
      this.callbacks.onTranscription('model', this.currentOutputText, false);
    }
    
    if (message.serverContent?.turnComplete) {
      if (this.currentInputText) this.callbacks.onTranscription('user', this.currentInputText, true);
      if (this.currentOutputText) this.callbacks.onTranscription('model', this.currentOutputText, true);
      this.currentInputText = '';
      this.currentOutputText = '';
    }

    // 2. Handle Tool Calls
    if (message.toolCall) {
      for (const fc of message.toolCall.functionCalls) {
        try {
          const response = await executeCommand(fc.name, fc.args, {
            onLog: (m, t) => this.callbacks.onLog(m, t),
            onSystem: (t) => this.callbacks.onSystemMessage(t),
            onDiff: (d) => this.callbacks.onDiffUpdate(d),
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

    // 3. Handle Audio Playback
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

    // 4. Handle Interruptions
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
