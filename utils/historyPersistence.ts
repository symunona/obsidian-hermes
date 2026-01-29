import { TranscriptionEntry, ArchivedConversation } from '../types';
import { getNextArchiveIndex, convertToMarkdown } from './archiveConversation';
import { addArchivedConversation, loadArchivedConversations } from '../persistence/persistence';
import { toYaml } from './yamlUtils';
import { createFile, createDirectory } from '../services/vaultOperations';
import { getErrorMessage } from './getErrorMessage';

/**
 * Interface for text interface that can generate summaries
 */
export interface SummaryGenerator {
  generateSummary: (prompt: string) => Promise<string>;
}

/**
 * Result of the persistence operation
 */
export interface PersistenceResult {
  success: boolean;
  message: string;
  skipped?: boolean;
  error?: string;
  key?: string;
  suggestedFilename?: string;
  notEnoughContent?: boolean;
}

/**
 * Options for persisting conversation history
 */
export interface PersistenceOptions {
  transcripts: TranscriptionEntry[];
  chatHistoryFolder: string;
  textInterface?: SummaryGenerator | null;
  topicId?: string;  // Topic ID for deduplication; if not provided, extracted from first transcript
}

/**
 * Extract keywords from text for fallback title generation
 */
const extractKeywordsFromText = (text: string): string => {
  return text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 4)
    .join(' ')
    .substring(0, 30)
    .trim() || 'Conversation';
};

/**
 * LLM-generated metadata structure
 */
export interface LLMGeneratedHeaderData {
  title: string;
  tags: string[];
  suggestedFilename: string;
  summary: string;
  shouldSave: boolean;
}

/**
 * Parse AI response to extract structured data
 */
const parseAiResponse = (aiResponse: string): LLMGeneratedHeaderData | null => {
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(aiResponse.replace(/```json\n?|```/g, '').trim());
    return {
      title: parsed.title ? String(parsed.title).substring(0, 30).trim() : 'Conversation',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      suggestedFilename: parsed.suggestedFilename ? String(parsed.suggestedFilename).substring(0, 40) : '',
      summary: parsed.summary ? String(parsed.summary) : '',
      shouldSave: parsed.shouldSave !== false // Default to true if not explicitly false
    };
  } catch {
    console.error('Failed to parse AI response as JSON for metadata extraction');
    // Not JSON, try to extract title directly
    const cleanedTitle = aiResponse
      .replace(/^(title|subject|topic):?\s*/i, '')
      .replace(/^["'`]|["'`]$/g, '')
      .replace(/\.$/, '')
      .trim()
      .substring(0, 30);
    
    if (cleanedTitle && cleanedTitle.length >= 2) {
      return {
        title: cleanedTitle,
        tags: [],
        suggestedFilename: cleanedTitle.toLowerCase().replace(/\s+/g, '-'),
        summary: '',
        shouldSave: true
      };
    }
  }
  return null;
};

/**
 * STEP 1: Filter transcripts for archiving
 * Removes verbose tool content that shouldn't be in the archive
 * Also removes toolData from all tools when persisting
 */
export const filterTranscriptsForArchive = (transcripts: TranscriptionEntry[]): TranscriptionEntry[] => {
  const FILTERED_TOOLS = ['context', 'file_tree', 'read_file', 'open_file'];
  
  return transcripts.filter(entry => {
    // Filter out welcome message
    if (entry.id === 'welcome-init') return false;
    
    // Filter out "done" acknowledgments from model
    if (entry.role === 'model' && entry.text.trim().toLowerCase().replace(/\./g, '') === 'done') return false;
    
    // Filter out verbose tool results entirely
    if (entry.toolData && FILTERED_TOOLS.includes(entry.toolData.name)) return false;
    
    return true;
  }).map(entry => {
    // Remove toolData from all remaining entries when persisting
    if (entry.toolData) {
      return { ...entry, toolData: undefined };
    }
    return entry;
  });
};

/**
 * Main function to persist conversation history
 * 
 * Pipeline Steps:
 * 1. FILTER - Remove verbose tool content (context, file_tree, read_file, open_file)
 * 2. TRANSFORM - Convert filtered history to markdown
 * 3. LLM CALL - Get title, tags, filename, summary, shouldSave
 * 4. CHECK - If shouldSave is false, skip
 * 5. FILENAME - Generate YYYY-MM-DD-II-keywords.md
 * 6. FRONTMATTER - Build YAML frontmatter from LLM data
 * 7. VAULT SAVE - Write markdown file to vault
 * 8. JSON SAVE - Save to plugin data
 */
export const persistConversationHistory = async (
  options: PersistenceOptions
): Promise<PersistenceResult> => {
  const { transcripts, chatHistoryFolder, textInterface, topicId: providedTopicId } = options;
  
  // Determine topicId - use provided or extract from first transcript
  const topicId = providedTopicId || transcripts[0]?.topicId || `topic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  // ========================================
  // STEP 0: DEDUP CHECK - Skip if topicId already archived
  // ========================================
  const existingArchives = await loadArchivedConversations();
  const alreadyArchived = existingArchives.some(a => a.topicId === topicId);
  if (alreadyArchived) {
    // console.warn(`[HISTORY] SKIP: Topic ${topicId} already archived`);
    return {
      success: true,
      message: `Topic already archived (${topicId})`,
      skipped: true
    };
  }

  // ========================================
  // STEP 1: FILTER - Remove verbose tool content
  // ========================================
  const filteredHistory = filterTranscriptsForArchive(transcripts);
  // console.warn(`[HISTORY] STEP 1 - FILTER: ${transcripts.length} entries -> ${filteredHistory.length} filtered`);
  
  // Check for meaningful content (at least one user or model message with actual text)
  const meaningfulEntries = filteredHistory.filter(
    entry => (entry.role === 'user' || entry.role === 'model') && entry.text?.trim().length > 0
  );
  
  // Check if content is too short/meaningless
  const totalTextLength = meaningfulEntries.reduce((sum, entry) => sum + (entry.text?.trim().length || 0), 0);
  const hasSubstantialContent = totalTextLength > 50 && meaningfulEntries.length >= 2;
  
  if (meaningfulEntries.length === 0 || !hasSubstantialContent) {
    // console.warn('[HISTORY] SKIP: No meaningful content to archive');
    return { 
      success: true, 
      message: 'No meaningful content to archive', 
      skipped: true,
      notEnoughContent: true
    };
  }

  // ========================================
  // STEP 2: TRANSFORM - Convert to markdown
  // ========================================
  const markdownContent = convertToMarkdown(filteredHistory);
  // console.warn(`[HISTORY] STEP 2 - MARKDOWN: length=${markdownContent.length}`);

  // ========================================
  // STEP 3: LLM CALL - Get metadata
  // ========================================
  // Build conversation text for LLM (user: ... model: ...)
  const conversationText = filteredHistory
    .filter(entry => entry.role === 'user' || entry.role === 'model')
    .map(entry => `${entry.role}: ${entry.text}`)
    .join('\n');

  // Default fallback values
  let llmData: LLMGeneratedHeaderData = {
    title: 'Conversation',
    tags: [],
    suggestedFilename: '',
    summary: '',
    shouldSave: true
  };
  
  // Extract keywords from first user message as fallback
  const firstUserMsg = filteredHistory.find(entry => entry.role === 'user')?.text || '';
  if (firstUserMsg.trim()) {
    llmData.title = extractKeywordsFromText(firstUserMsg);
    llmData.suggestedFilename = extractKeywordsFromText(firstUserMsg).toLowerCase().replace(/\s+/g, '-');
  }

  if (textInterface && conversationText.trim()) {
    const prompt = `Generate a JSON response with these fields:
- "title": A short, keyword-rich title (2-4 words, max 30 characters)
- "tags": Array of relevant tags for this conversation (e.g. ["file-management", "search"])
- "suggestedFilename": Primary keywords focusing on the TOPIC/CONTENT discussed, not file operations. Use lowercase, hyphen-separated (max 40 characters)
- "summary": A bulletpoint list summarizing the conversation
- "shouldSave": true/false - does this conversation have meaningful content worth saving?
  (false for: just greetings, "hi", "hello", "what were we doing", empty exchanges)

IMPORTANT: For filename generation, focus on WHAT WAS DISCUSSED or ACCOMPLISHED, not HOW it was done. 
Examples:
- GOOD: "react-component-refactor", "openai-api-integration-setup", "wedding-planning", "ai-doomsday-scenarios", "weekend-activities", "present-ideas", "pupl-fiction-movie-review"
- BAD: "create-file", "edit-code", "rename-component", "file-operations", "image-search", "file-management"

Conversation:
${conversationText}

Respond ONLY with valid JSON, no markdown.`;

    // console.warn('[HISTORY] STEP 3 - LLM: Requesting metadata...');

    try {
      const aiResponse = await textInterface.generateSummary(prompt);
      // console.warn(`[HISTORY] STEP 3 - LLM: Response received, length=${aiResponse.length}`);

      const parsedResponse = parseAiResponse(aiResponse);
      if (parsedResponse) {
        llmData = parsedResponse;
      }
    } catch (error) {
      console.warn('[HISTORY] STEP 3 - LLM FAILED:', getErrorMessage(error));
      // Continue with fallback values
    }
  } else {
    // console.warn('[HISTORY] STEP 3 - LLM: Skipped (no text interface)');
  }

  // ========================================
  // STEP 4: CHECK - Should we save?
  // ========================================
  // console.warn(`[HISTORY] STEP 4 - CHECK: shouldSave=${llmData.shouldSave}`);
  
  if (!llmData.shouldSave) {
    // console.warn('[HISTORY] SKIP: Nothing to export (shouldSave=false)');
    return { 
      success: true, 
      message: 'Content not substantial enough to archive', 
      skipped: true,
      notEnoughContent: true
    };
  }

  // ========================================
  // STEP 5: FILENAME - Generate YYYY-MM-DD-II-keywords.md
  // ========================================
  const archiveIndex = await getNextArchiveIndex(chatHistoryFolder);
  const safeFilename = llmData.suggestedFilename
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .substring(0, 40) || 'conversation';
  const filename = `${chatHistoryFolder}/${archiveIndex}-${safeFilename}.md`;
  // console.warn(`[HISTORY] STEP 5 - FILENAME: ${filename}`);

  // ========================================
  // STEP 6: FRONTMATTER - Build YAML from LLM data
  // ========================================
  const timestamps = filteredHistory.map(t => t.timestamp).filter(t => t > 0);
  const now = new Date();
  const startDate = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : now.toISOString();
  const endDate = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : now.toISOString();
  const duration = timestamps.length > 1 ? Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 1000) : 0;

  const frontmatterData = {
    title: llmData.title.length > 50 ? llmData.title.substring(0, 47) + '...' : llmData.title,
    topic_id: topicId,
    date: startDate,
    end_date: endDate,
    duration: duration,
    tags: llmData.tags,
    format: 'hermes-chat-archive',
    summary: llmData.summary
  };
  
  const frontmatter = `---\n${toYaml(frontmatterData)}---\n\n`;
  // console.warn('[HISTORY] STEP 6 - YAML: Built frontmatter');

  // ========================================
  // STEP 7: VAULT SAVE - Write markdown file
  // ========================================
  try {
    await createDirectory(chatHistoryFolder);
    const fullContent = frontmatter + markdownContent;
    await createFile(filename, fullContent);
    // console.warn('[HISTORY] STEP 7 - VAULT: Saved');
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    // console.error('[HISTORY] STEP 7 - VAULT SAVE FAILED:', errorMsg);
    return { success: false, message: 'Failed to save to vault', error: errorMsg };
  }

  // ========================================
  // STEP 8: JSON SAVE - Save to plugin history array
  // ========================================
  try {
    const key = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // ArchivedConversation includes all LLM-HEADER-DATA + FILTERED-HISTORY
    const archivedConversation: ArchivedConversation = {
      key,
      topicId,
      title: llmData.title,
      tags: llmData.tags,
      summary: llmData.summary,
      suggestedFilename: llmData.suggestedFilename,
      archivedAt: Date.now(),
      conversation: filteredHistory  // FILTERED-HISTORY from STEP 1
    };
    
    await addArchivedConversation(archivedConversation);
    // console.warn('[HISTORY] STEP 8 - PLUGIN: Saved to history array');
    
    return { 
      success: true, 
      message: `Conversation archived to ${filename}`, 
      key, 
      suggestedFilename: llmData.suggestedFilename, 
      notEnoughContent: false 
    };
  } catch (error) {
    const errorMsg = getErrorMessage(error);
    // console.error('[HISTORY] STEP 8 - JSON SAVE FAILED:', errorMsg);
    return { success: false, message: 'Failed to save to plugin data', error: errorMsg };
  }
};
