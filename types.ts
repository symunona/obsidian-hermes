
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
  web?: { uri?: string; title?: string };
  maps?: { uri?: string; title?: string };
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
  directoryInfo?: DirectoryInfoItem[];
  searchResults?: SearchResult[] | ImageSearchResult[]; // Can be either SearchResult[] or image search results
  searchKeyword?: string;
  multiDiffs?: FileDiff[];
  groundingChunks?: GroundingChunk[];
  truncated?: boolean;
  totalItems?: number;
  shownItems?: number;
  currentPage?: number;
  totalPages?: number;
  truncationNotice?: string;
  downloadedImages?: DownloadedImage[]; // For image search downloaded images
  targetFolder?: string; // For image search target folder
  totalFound?: number; // For image search total found
  folderPath?: string;
  systemPath?: string;
  paneInfo?: Record<string, unknown>;
  targetPath?: string;
  originalPath?: string;
  restoredPath?: string;
  description?: string;
  contextInfo?: Record<string, unknown>;
  dropdown?: boolean; // Whether to show dropdown for expandable content
  displayFormat?: string; // Custom display format with HTML for special styling
  duration?: number; // Time taken to execute the tool in milliseconds
  responseLength?: number; // Length of the response content
}

export interface TranscriptionEntry {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  isComplete: boolean;
  toolData?: ToolData;
  timestamp: number;
  topicId?: string;  // Groups messages by conversation topic; changes on topic_switch
}

/**
 * Archived conversation with LLM-generated metadata
 * See HISTORY-PERSISTENCE.md for the full pipeline documentation
 */
export interface ArchivedConversation {
  key: string;
  topicId: string;                    // Unique topic identifier for deduplication
  title: string;                      // From LLM (STEP 3)
  tags: string[];                     // From LLM (STEP 3)
  summary: string;                    // From LLM (STEP 3)
  suggestedFilename: string;          // From LLM (STEP 3)
  archivedAt: number;
  conversation: TranscriptionEntry[]; // FILTERED-HISTORY from STEP 1
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
  manualApiKey?: string;
  serperApiKey?: string;
  chatHistoryFolder?: string;
  currentFolder?: string;
  currentNote?: string | null;
  transcripts?: TranscriptionEntry[];
  totalTokens?: number;
  chatHistory?: string[];
}

export interface VoiceAssistantCallbacks {
  onStatusChange: (status: ConnectionStatus) => void;
  onLog: (message: string, type: LogEntry['type'], duration?: number, errorDetails?: LogEntry['errorDetails']) => void;
  onTranscription: (role: 'user' | 'model', text: string, isComplete: boolean) => void;
  onSystemMessage: (text: string, toolData?: ToolData) => void;
  onToast?: (message: string, duration?: number) => void;
  onInterrupted: () => void;
  onFileStateChange: (folder: string, note: string | string[] | null) => void;
  onUsageUpdate: (usage: UsageMetadata) => void;
  onVolume: (volume: number) => void;
  onArchiveConversation?: () => Promise<void>;
}

export interface ToolCallbacks {
  onLog: (message: string, type: LogEntry['type'], duration?: number, errorDetails?: LogEntry['errorDetails']) => void;
  onSystem: (text: string, toolData?: ToolData) => void;
  onFileState: (folder: string, note: string | string[] | null) => void;
  onStopSession?: () => void;
  onArchiveConversation?: () => Promise<void>;
}

export interface ImageSearchResult {
  url: string;
  title: string;
  description?: string;
  image?: {
    height?: number;
    width?: number;
    thumbnail?: string;
    contextLink?: string;
  };
  source?: string;
  query?: string;
  originalQuery?: string;
}

export interface DownloadedImage {
  filename: string;
  type: string;
  size: number;
  filePath: string;
}

export interface DirectoryInfoItem {
  path: string;
  type?: 'directory' | 'file';
  hasChildren?: boolean;
}

declare global {
  interface Window {
    hermesSettingsUpdate?: (settings: AppSettings) => void;
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface VoiceAssistant {
  start: (apiKey: string, config: AppSettings, initialState?: { folder: string; note: string | null }, conversationHistory?: string) => Promise<void>;
  stop: () => void;
}
