
import * as list_directory from '../tools/list_directory';
import * as list_vault_files from '../tools/list_vault_files';
import * as get_folder_tree from '../tools/get_folder_tree';
import * as dirlist from '../tools/dirlist';
import * as read_file from '../tools/read_file';
import * as create_file from '../tools/create_file';
import * as update_file from '../tools/update_file';
import * as edit_file from '../tools/edit_file';
import * as rename_file from '../tools/rename_file';
import * as move_file from '../tools/move_file';
import * as search_keyword from '../tools/search_keyword';
import * as search_regexp from '../tools/search_regexp';
import * as search_replace_file from '../tools/search_replace_file';
import * as search_replace_global from '../tools/search_replace_global';
import * as topic_switch from '../tools/topic_switch';
import * as create_directory from '../tools/create_directory';
import * as delete_file from '../tools/delete_file';
import * as web_search from '../tools/web_search';
import * as end_conversation from '../tools/end_conversation';
import * as generate_image_from_context from '../tools/generate_image_from_context';
import * as reveal_active_pane from '../tools/reveal_active_pane';
import * as open_folder_in_system from '../tools/open_folder_in_system';
import * as image_search from '../tools/image_search';
import * as download_image from '../tools/download_image';
import * as list_trash from '../tools/list_trash';
import * as restore_from_trash from '../tools/restore_from_trash';
import { ToolData } from '../types';

const TOOLS: Record<string, any> = {
  list_directory,
  list_vault_files,
  get_folder_tree,
  dirlist,
  read_file,
  create_file,
  create_directory,
  delete_file,
  update_file,
  edit_file,
  rename_file,
  move_file,
  search_keyword,
  search_regexp,
  search_and_replace_regex_in_file: search_replace_file,
  search_and_replace_regex_global: search_replace_global,
  topic_switch,
  internet_search: web_search,
  generate_image_from_context,
  end_conversation,
  reveal_active_pane,
  open_folder_in_system,
  image_search,
  download_image,
  list_trash,
  restore_from_trash
};

export const COMMAND_DECLARATIONS = Object.values(TOOLS).map(t => t.declaration);

export const executeCommand = async (
  name: string, 
  args: any, 
  callbacks: {
    onLog: (msg: string, type: 'action' | 'error', duration?: number, errorDetails?: any) => void,
    onSystem: (text: string, toolData?: ToolData) => void,
    onFileState: (folder: string, note: string | string[] | null) => void,
    onStopSession?: () => void,
    onArchiveConversation?: () => Promise<void>
  },
  existingToolCallId?: string
): Promise<any> => {
  const startTime = performance.now();
  const tool = TOOLS[name];

  if (!tool) {
    const errorDetails = {
      toolName: name,
      content: JSON.stringify(args, null, 2),
      contentSize: JSON.stringify(args).length,
      apiCall: 'executeCommand'
    };
    callbacks.onLog(`Tool not found: ${name}`, 'error', undefined, errorDetails);
    throw new Error(`Command ${name} not found`);
  }

  // Use existing ID if provided, otherwise generate new one
  const toolCallId = existingToolCallId || `tool-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  // Only create pending message if we generated a new ID (no existing one passed)
  if (!existingToolCallId) {
    callbacks.onSystem(`${name.replace(/_/g, ' ').toUpperCase()}...`, {
      id: toolCallId,
      name,
      filename: args.filename || (name === 'internet_search' ? 'Web' : 'Registry'),
      status: 'pending'
    });
  }

  // Wrapped callbacks to ensure tool call ID is preserved for updates
  const wrappedCallbacks = {
    ...callbacks,
    onSystem: (text: string, toolData?: ToolData) => {
      callbacks.onSystem(text, { ...toolData, id: toolCallId } as ToolData);
    }
  };

  try {
    const result = await tool.execute(args, wrappedCallbacks);
    
    // Check if result exceeds threshold and needs truncation
    const truncatedResult = truncateLargeResult(name, result, wrappedCallbacks);
    
    const duration = Math.round(performance.now() - startTime);
    callbacks.onLog(`Executed ${name} in ${duration}ms`, 'action', duration);
    return truncatedResult;
  } catch (error: any) {
    const duration = Math.round(performance.now() - startTime);
    const errorDetails = {
      toolName: name,
      content: JSON.stringify(args, null, 2),
      contentSize: JSON.stringify(args).length,
      stack: error.stack,
      apiCall: 'tool_execution'
    };
    callbacks.onLog(`Error in ${name}: ${error.message}`, 'error', duration, errorDetails);
    wrappedCallbacks.onSystem(`Error: ${error.message}`, { 
      name, 
      filename: args.filename || (name === 'internet_search' ? 'Web' : 'unknown'), 
      error: error.message,
      status: 'error'
    } as ToolData);
    throw error;
  }
};

// Helper function to truncate large results and add pagination info
function truncateLargeResult(toolName: string, result: any, callbacks: any): any {
  const MAX_ITEMS = 100;
  
  // Handle different result structures
  if (result?.files && Array.isArray(result.files)) {
    const totalFiles = result.files.length;
    
    if (totalFiles > MAX_ITEMS) {
      const truncatedFiles = result.files.slice(0, MAX_ITEMS);
      const totalPages = Math.ceil(totalFiles / MAX_ITEMS);
      const currentPage = 1;
      
      // Create truncation notice for AI
      const truncationNotice = `\n\n=== RESULT TRUNCATED ===\nShowing ${MAX_ITEMS} of ${totalFiles} items (Page ${currentPage} of ${totalPages}).\n\nTo see more results, consider:\n- Using list_vault_files with pagination (limit/offset parameters)\n- Using search_keyword or search_regexp for targeted searches\n- Using get_folder_tree for folder structure only\n- Adding a filter parameter to narrow results\n\nCurrent results show first ${MAX_ITEMS} items only.`;
      
      // Log truncation info
      console.log(`Tool result truncated: ${toolName}, ${MAX_ITEMS}/${totalFiles} items, page ${currentPage}/${totalPages}`);
      
      // Update system message with truncation info
      callbacks.onSystem(`Registry Scanned (TRUNCATED: ${MAX_ITEMS}/${totalFiles} items)`, {
        name: toolName,
        filename: 'Vault Root',
        files: truncatedFiles,
        truncated: true,
        totalItems: totalFiles,
        shownItems: MAX_ITEMS,
        currentPage: currentPage,
        totalPages: totalPages
      });
      
      // Return truncated result with notice
      return {
        ...result,
        files: truncatedFiles,
        truncated: true,
        totalItems: totalFiles,
        shownItems: MAX_ITEMS,
        currentPage: currentPage,
        totalPages: totalPages,
        truncationNotice
      };
    }
  }
  
  if (result?.folders && Array.isArray(result.folders)) {
    const totalFolders = result.folders.length;
    
    if (totalFolders > MAX_ITEMS) {
      const truncatedFolders = result.folders.slice(0, MAX_ITEMS);
      const totalPages = Math.ceil(totalFolders / MAX_ITEMS);
      const currentPage = 1;
      
      const truncationNotice = `\n\n=== RESULT TRUNCATED ===\nShowing ${MAX_ITEMS} of ${totalFolders} folders (Page ${currentPage} of ${totalPages}).\n\nFor large folder structures, consider:\n- Using search_keyword to find specific folders\n- Using list_vault_files with filter parameter\n- Asking for a specific subfolder path\n\nCurrent results show first ${MAX_ITEMS} folders only.`;
      
      console.log(`Folder structure truncated: ${toolName}, ${MAX_ITEMS}/${totalFolders} folders, page ${currentPage}/${totalPages}`);
      
      callbacks.onSystem(`Folder Structure Scanned (TRUNCATED: ${MAX_ITEMS}/${totalFolders} folders)`, {
        name: toolName,
        filename: 'Folder Tree',
        files: truncatedFolders,
        truncated: true,
        totalItems: totalFolders,
        shownItems: MAX_ITEMS,
        currentPage: currentPage,
        totalPages: totalPages
      });
      
      return {
        ...result,
        folders: truncatedFolders,
        truncated: true,
        totalItems: totalFolders,
        shownItems: MAX_ITEMS,
        currentPage: currentPage,
        totalPages: totalPages,
        truncationNotice
      };
    }
  }
  
  // Handle directory list (hierarchical structure)
  if (result?.directories && Array.isArray(result.directories)) {
    const flattenDirectories = (dirs: any[], count = 0): { items: any[], total: number } => {
      let items: any[] = [];
      let total = count;
      
      dirs.forEach(dir => {
        items.push({ path: dir.path, type: 'directory', hasChildren: dir.children && dir.children.length > 0 });
        total++;
        
        if (dir.children && dir.children.length > 0) {
          const childResult = flattenDirectories(dir.children, total);
          items = items.concat(childResult.items);
          total = childResult.total;
        }
      });
      
      return { items, total };
    };
    
    const { items: flatDirs, total: totalDirectories } = flattenDirectories(result.directories);
    
    if (totalDirectories > MAX_ITEMS) {
      const truncatedDirs = flatDirs.slice(0, MAX_ITEMS);
      const totalPages = Math.ceil(totalDirectories / MAX_ITEMS);
      const currentPage = 1;
      
      const truncationNotice = `\n\n=== DIRECTORY LIST TRUNCATED ===\nShowing ${MAX_ITEMS} of ${totalDirectories} directories (Page ${currentPage} of ${totalPages}).\n\nFor large directory structures, consider:\n- Using search_keyword to find specific directories\n- Using list_vault_files with filter parameter\n- Asking for a specific directory path\n- Using get_folder_tree for a simple folder list\n\nCurrent results show first ${MAX_ITEMS} directories only.`;
      
      console.log(`Directory list truncated: ${toolName}, ${MAX_ITEMS}/${totalDirectories} directories, page ${currentPage}/${totalPages}`);
      
      callbacks.onSystem(`Directory Structure Scanned (TRUNCATED: ${MAX_ITEMS}/${totalDirectories} directories)`, {
        name: toolName,
        filename: 'Directory List',
        files: truncatedDirs.map(d => d.path),
        truncated: true,
        totalItems: totalDirectories,
        shownItems: MAX_ITEMS,
        currentPage: currentPage,
        totalPages: totalPages,
        directoryInfo: truncatedDirs
      });
      
      return {
        ...result,
        directories: truncatedDirs,
        truncated: true,
        totalItems: totalDirectories,
        shownItems: MAX_ITEMS,
        currentPage: currentPage,
        totalPages: totalPages,
        truncationNotice
      };
    }
  }
  
  // Handle search results that might be large
  if (result?.results && Array.isArray(result.results)) {
    const totalResults = result.results.length;
    
    if (totalResults > MAX_ITEMS) {
      const truncatedResults = result.results.slice(0, MAX_ITEMS);
      const totalPages = Math.ceil(totalResults / MAX_ITEMS);
      const currentPage = 1;
      
      const truncationNotice = `\n\n=== SEARCH RESULTS TRUNCATED ===\nShowing ${MAX_ITEMS} of ${totalResults} results (Page ${currentPage} of ${totalPages}).\n\nFor more results, consider:\n- Refining your search terms\n- Using pagination parameters if available\n- Adding filters to narrow the search\n\nCurrent results show first ${MAX_ITEMS} matches only.`;
      
      console.log(`Search results truncated: ${toolName}, ${MAX_ITEMS}/${totalResults} results, page ${currentPage}/${totalPages}`);
      
      return {
        ...result,
        results: truncatedResults,
        truncated: true,
        totalItems: totalResults,
        shownItems: MAX_ITEMS,
        currentPage: currentPage,
        totalPages: totalPages,
        truncationNotice
      };
    }
  }
  
  // Check if result is a large string (like file content)
  if (typeof result === 'string' && result.length > 50000) {
    const truncatedContent = result.substring(0, 50000);
    const truncationNotice = `\n\n=== CONTENT TRUNCATED ===\nShowing first 50,000 characters of ${result.length} total characters.\n\nFor large files, consider:\n- Reading specific sections with line numbers\n- Searching for specific content within the file\n- Using more targeted read operations\n\nCurrent content shows first 50,000 characters only.`;
    
    console.log(`Content truncated: ${toolName}, 50000/${result.length} chars`);
    
    return truncatedContent + truncationNotice;
  }
  
  return result;
}
