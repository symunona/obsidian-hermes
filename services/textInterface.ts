import { GoogleGenAI, Content, Part, FunctionCall } from '@google/genai';
import { AppSettings, UsageMetadata, ToolData, LogEntry } from '../types';
import { COMMAND_DECLARATIONS, executeCommand } from './commands';
import { withRetry, RetryCounter } from '../utils/retryUtils';

export interface TextInterfaceCallbacks {
  onLog: (message: string, type: LogEntry['type'], duration?: number, errorDetails?: LogEntry['errorDetails']) => void;
  onTranscription: (role: 'user' | 'model', text: string, isComplete: boolean) => void;
  onSystemMessage: (text: string, toolData?: ToolData) => void;
  onFileStateChange: (folder: string, note: string | string[] | null) => void;
  onUsageUpdate: (usage: UsageMetadata) => void;
  onArchiveConversation?: () => Promise<void>;
}

export class GeminiTextInterface {
  private ai: GoogleGenAI | null = null;
  private chatHistory: Content[] = [];
  private currentFolder = '/';
  private currentNote: string | null = null;
  private systemInstruction: string = '';
  private model = 'gemini-2.0-flash';
  private retryCounter = new RetryCounter(2);

  constructor(private callbacks: TextInterfaceCallbacks) {}

  initialize(
    apiKey: string,
    settings: AppSettings,
    initialState?: { folder: string; note: string | null }
  ): void {
    if (initialState) {
      this.currentFolder = initialState.folder;
      this.currentNote = initialState.note;
    }

    this.callbacks.onLog('Initializing text interface...', 'info');

    this.ai = new GoogleGenAI({ apiKey });

    const contextString = `
CURRENT_CONTEXT:
Current Folder Path: ${this.currentFolder}
Current Note Name: ${this.currentNote || 'No note currently selected'}
`;
    this.systemInstruction = `${settings.systemInstruction}\n${contextString}\n\n${settings.customContext}`.trim();

    this.callbacks.onLog('Text interface ready.', 'info');
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.ai) {
      this.callbacks.onLog('Text interface not initialized', 'error');
      return;
    }

    // Add user message to history
    this.chatHistory.push({
      role: 'user',
      parts: [{ text }]
    });

    // Show user message immediately
    this.callbacks.onTranscription('user', text, true);

    await withRetry(
      async () => {
        this.retryCounter.increment();
        await this.processConversation();
      },
      {
        maxRetries: 2,
        delay: 1000,
        onRetry: (attempt, _error) => {
          this.callbacks.onLog(`Text API failed, retrying attempt ${attempt}/2...`, 'info');
          this.callbacks.onSystemMessage(`Text API failed, retrying attempt ${attempt}/2...`);
        }
      }
    );
  }

  private async processConversation(): Promise<void> {
    if (!this.ai) return;

    // Show typing indicator
    this.callbacks.onTranscription('model', '...', false);

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: this.chatHistory,
      config: {
        systemInstruction: this.systemInstruction,
        tools: [{ functionDeclarations: COMMAND_DECLARATIONS }]
      }
    });

    // Handle usage metadata
    if (response.usageMetadata) {
      this.callbacks.onUsageUpdate({
        promptTokenCount: response.usageMetadata.promptTokenCount,
        candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
        totalTokenCount: response.usageMetadata.totalTokenCount
      });
    }

    const candidate = response.candidates?.[0];
    if (!candidate?.content) {
      this.callbacks.onTranscription('model', 'No response received.', true);
      return;
    }

    // Check for function calls
    const functionCalls = candidate.content.parts?.filter(
      (part): part is Part & { functionCall: FunctionCall } => !!part.functionCall
    );

    if (functionCalls && functionCalls.length > 0) {
      // Add model's function call response to history
      this.chatHistory.push(candidate.content);

      // Execute each function call
      const functionResponses: Part[] = [];

      for (const part of functionCalls) {
        const fc = part.functionCall;
        try {
          const result = await executeCommand(fc.name, fc.args, {
            onLog: (m, t, d) => this.callbacks.onLog(m, t, d),
            onSystem: (t, d) => this.callbacks.onSystemMessage(t, d),
            onFileState: (folder, note) => {
              this.currentFolder = folder;
              this.currentNote = Array.isArray(note) ? note[note.length - 1] : note;
              this.callbacks.onFileStateChange(folder, note);
            },
            onStopSession: () => {
              // For text interface, we don't have a session to stop, but we can log it
              this.callbacks.onLog('Conversation ended via tool call', 'info');
            },
            onArchiveConversation: this.callbacks.onArchiveConversation
          }, this.currentFolder);

          functionResponses.push({
            functionResponse: {
              name: fc.name,
              response: { result }
            }
          });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const errorStack = err instanceof Error ? err.stack : undefined;
          console.error(`Text interface tool error: ${fc.name} - ${errorMessage}`);
          
          const errorDetails = {
            toolName: fc.name,
            content: JSON.stringify(fc.args, null, 2),
            contentSize: JSON.stringify(fc.args).length,
            stack: errorStack,
            apiCall: 'executeCommand',
            timestamp: new Date().toISOString(),
            model: this.model,
            currentFolder: this.currentFolder,
            currentNote: this.currentNote
          };
          this.callbacks.onLog(`Tool execution error in ${fc.name}: ${errorMessage}`, 'error', undefined, errorDetails);
          
          // Show error as system message in chat
          this.callbacks.onSystemMessage(`Error in ${fc.name}: ${errorMessage}`, {
            id: 'error-' + Date.now(),
            name: 'error',
            filename: '',
            status: 'error',
            error: errorMessage
          });

          functionResponses.push({
            functionResponse: {
              name: fc.name,
              response: { error: errorMessage }
            }
          });
        }
      }

      // Add function responses to history
      this.chatHistory.push({
        role: 'user',
        parts: functionResponses
      });

      // Continue the conversation to get the final response
      await this.processConversation();
    } else {
      // Extract text response
      const textParts = candidate.content.parts?.filter(part => part.text);
      const responseText = textParts?.map(part => part.text).join('') || '';

      // Add model response to history
      this.chatHistory.push(candidate.content);

      // Show the response
      this.callbacks.onTranscription('model', responseText, true);
    }
  }

  setApiKey(apiKey: string): void {
    this.ai = new GoogleGenAI({ apiKey });
  }

  clearHistory(): void {
    this.chatHistory = [];
  }

  getHistory(): Content[] {
    return this.chatHistory;
  }

  async generateSummary(prompt: string): Promise<string> {
    if (!this.ai) {
      throw new Error('Text interface not initialized');
    }

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      });

      const candidate = response.candidates?.[0];
      const textParts = candidate?.content?.parts?.filter(part => part.text);
      return textParts?.map(part => part.text).join('') || '';
    } catch (error) {
      console.error('Text interface error:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate summary: ${message}`);
    }
  }
}
