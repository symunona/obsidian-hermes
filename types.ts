
export interface LogEntry {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'action' | 'error';
}

export interface TranscriptionEntry {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  isComplete: boolean;
}

export interface FileData {
  name: string;
  content: string;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface AppSettings {
  voiceName: string;
  customContext: string;
  systemInstruction: string;
}

// Abstraction interfaces
export interface VoiceAssistantCallbacks {
  onStatusChange: (status: ConnectionStatus) => void;
  onLog: (message: string, type: LogEntry['type']) => void;
  onTranscription: (role: 'user' | 'model', text: string, isComplete: boolean) => void;
  onSystemMessage: (text: string) => void;
  onDiffUpdate: (diff: { filename: string, old: string, new: string } | null) => void;
  onInterrupted: () => void;
  onFileStateChange: (folder: string, note: string | null) => void;
}

export interface VoiceAssistant {
  start: (apiKey: string, config: AppSettings) => Promise<void>;
  stop: () => void;
  sendText: (text: string) => void;
}
