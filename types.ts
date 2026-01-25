
export interface LogEntry {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'action' | 'error';
  duration?: number; // Time in ms
  errorDetails?: {
    toolName?: string;
    content?: string;
    contentSize?: number;
    stack?: string;
    apiCall?: string;
    requestSize?: number;
    responseSize?: number;
  };
}

export interface SearchMatch {
  line: number;
  content: string;
  contextBefore?: string[];
  contextAfter?: string[];
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

export interface GroundingChunk {
  web?: { uri: string; title: string };
  maps?: { uri: string; title: string };
}

export interface ToolData {
  id?: string;
  name: string;
  filename: string;
  status?: 'pending' | 'success' | 'error' | 'search_results';
  oldContent?: string;
  newContent?: string;
  additions?: number;
  removals?: number;
  error?: string;
  files?: string[];
  directoryInfo?: any[];
  searchResults?: SearchResult[] | any[]; // Can be either SearchResult[] or image search results
  multiDiffs?: FileDiff[];
  groundingChunks?: GroundingChunk[];
  truncated?: boolean;
  totalItems?: number;
  shownItems?: number;
  currentPage?: number;
  totalPages?: number;
  truncationNotice?: string;
  downloadedImages?: any[]; // For image search downloaded images
  targetFolder?: string; // For image search target folder
  totalFound?: number; // For image search total found
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

export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export interface AppSettings {
  voiceName: string;
  customContext: string;
  systemInstruction: string;
  currentFolder?: string;
  currentNote?: string | null;
  transcripts?: TranscriptionEntry[];
  totalTokens?: number;
  manualApiKey?: string;
  googleSearchEngineId?: string;
}

export interface VoiceAssistantCallbacks {
  onStatusChange: (status: ConnectionStatus) => void;
  onLog: (message: string, type: LogEntry['type'], duration?: number, errorDetails?: LogEntry['errorDetails']) => void;
  onTranscription: (role: 'user' | 'model', text: string, isComplete: boolean) => void;
  onSystemMessage: (text: string, toolData?: ToolData) => void;
  onInterrupted: () => void;
  onFileStateChange: (folder: string, note: string | string[] | null) => void;
  onUsageUpdate: (usage: UsageMetadata) => void;
  onVolume: (volume: number) => void;
  onArchiveConversation?: () => Promise<void>;
}

export interface VoiceAssistant {
  start: (apiKey: string, config: AppSettings) => Promise<void>;
  stop: () => void;
  sendText: (text: string) => void;
}
