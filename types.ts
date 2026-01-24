
export interface LogEntry {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'action' | 'error';
  duration?: number; // Time in ms
}

export interface SearchMatch {
  line: number;
  content: string;
}

export interface SearchResult {
  filename: string;
  matches: SearchMatch[];
}

export interface FileDiff {
  filename: string;
  oldContent?: string;
  newContent?: string;
  additions?: number;
  removals?: number;
}

export interface ToolData {
  name: string;
  filename: string;
  oldContent?: string;
  newContent?: string;
  additions?: number;
  removals?: number;
  error?: string;
  files?: string[];
  searchResults?: SearchResult[];
  multiDiffs?: FileDiff[];
}

export interface TranscriptionEntry {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  isComplete: boolean;
  toolData?: ToolData;
  timestamp: number;
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
  currentFolder?: string;
  currentNote?: string | null;
  transcripts?: TranscriptionEntry[];
  totalTokens?: number;
}

export interface VoiceAssistantCallbacks {
  onStatusChange: (status: ConnectionStatus) => void;
  onLog: (message: string, type: LogEntry['type'], duration?: number) => void;
  onTranscription: (role: 'user' | 'model', text: string, isComplete: boolean) => void;
  onSystemMessage: (text: string, toolData?: ToolData) => void;
  onInterrupted: () => void;
  onFileStateChange: (folder: string, note: string | null) => void;
  onUsageUpdate: (usage: { promptTokens?: number; candidatesTokens?: number; totalTokens?: number }) => void;
}

export interface VoiceAssistant {
  start: (apiKey: string, config: AppSettings) => Promise<void>;
  stop: () => void;
  sendText: (text: string) => void;
}
