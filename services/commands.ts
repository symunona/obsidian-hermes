
import * as list_directory from '../tools/list_directory';
import * as list_vault_files from '../tools/list_vault_files';
import * as get_folder_tree from '../tools/get_folder_tree';
import * as read_file from '../tools/read_file';
import * as create_file from '../tools/create_file';
import * as update_file from '../tools/update_file';
import * as edit_file from '../tools/edit_file';
import * as rename_file from '../tools/rename_file';
import * as search_keyword from '../tools/search_keyword';
import * as search_regexp from '../tools/search_regexp';
import * as search_replace_file from '../tools/search_replace_file';
import * as search_replace_global from '../tools/search_replace_global';
import * as topic_switch from '../tools/topic_switch';
import * as web_search from '../tools/web_search';
import { ToolData } from '../types';

const TOOLS: Record<string, any> = {
  list_directory,
  list_vault_files,
  get_folder_tree,
  read_file,
  create_file,
  update_file,
  edit_file,
  rename_file,
  search_keyword,
  search_regexp,
  search_and_replace_regex_in_file: search_replace_file,
  search_and_replace_regex_global: search_replace_global,
  topic_switch,
  internet_search: web_search
};

export const COMMAND_DECLARATIONS = Object.values(TOOLS).map(t => t.declaration);

export const executeCommand = async (
  name: string, 
  args: any, 
  callbacks: {
    onLog: (msg: string, type: 'action' | 'error', duration?: number) => void,
    onSystem: (text: string, toolData?: ToolData) => void,
    onFileState: (folder: string, note: string | string[] | null) => void
  }
): Promise<any> => {
  const startTime = performance.now();
  const tool = TOOLS[name];

  if (!tool) {
    callbacks.onLog(`Tool not found: ${name}`, 'error');
    throw new Error(`Command ${name} not found`);
  }

  const toolCallId = `tool-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  // Signal start of execution
  callbacks.onSystem(`${name.replace(/_/g, ' ').toUpperCase()}...`, {
    id: toolCallId,
    name,
    filename: args.filename || (name === 'internet_search' ? 'Web' : 'Registry'),
    status: 'pending'
  });

  // Wrapped callbacks to ensure tool call ID is preserved for updates
  const wrappedCallbacks = {
    ...callbacks,
    onSystem: (text: string, toolData?: ToolData) => {
      callbacks.onSystem(text, { ...toolData, id: toolCallId } as ToolData);
    }
  };

  try {
    const result = await tool.execute(args, wrappedCallbacks);
    const duration = Math.round(performance.now() - startTime);
    callbacks.onLog(`Executed ${name} in ${duration}ms`, 'action', duration);
    return result;
  } catch (error: any) {
    const duration = Math.round(performance.now() - startTime);
    callbacks.onLog(`Error in ${name}: ${error.message}`, 'error', duration);
    wrappedCallbacks.onSystem(`Error: ${error.message}`, { 
      name, 
      filename: args.filename || (name === 'internet_search' ? 'Web' : 'unknown'), 
      error: error.message,
      status: 'error'
    } as ToolData);
    throw error;
  }
};
