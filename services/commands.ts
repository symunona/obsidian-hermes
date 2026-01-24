
import * as list_directory from '../tools/list_directory';
import * as read_file from '../tools/read_file';
import * as create_file from '../tools/create_file';
import * as update_file from '../tools/update_file';
import * as edit_file from '../tools/edit_file';
import * as search_keyword from '../tools/search_keyword';
import * as search_regexp from '../tools/search_regexp';
import * as search_replace_file from '../tools/search_replace_file';
import * as search_replace_global from '../tools/search_replace_global';
import * as topic_switch from '../tools/topic_switch';
import { ToolData } from '../types';

const TOOLS: Record<string, any> = {
  list_directory,
  read_file,
  create_file,
  update_file,
  edit_file,
  search_keyword,
  search_regexp,
  search_and_replace_regex_in_file: search_replace_file,
  search_and_replace_regex_global: search_replace_global,
  topic_switch
};

export const COMMAND_DECLARATIONS = Object.values(TOOLS).map(t => t.declaration);

export const executeCommand = async (
  name: string, 
  args: any, 
  callbacks: {
    onLog: (msg: string, type: 'action' | 'error', duration?: number) => void,
    onSystem: (text: string, toolData?: ToolData) => void,
    onFileState: (folder: string, note: string | null) => void
  }
): Promise<any> => {
  const startTime = performance.now();
  const tool = TOOLS[name];

  if (!tool) {
    callbacks.onLog(`Tool not found: ${name}`, 'error');
    throw new Error(`Command ${name} not found`);
  }

  try {
    const result = await tool.execute(args, callbacks);
    const duration = Math.round(performance.now() - startTime);
    callbacks.onLog(`Executed ${name} in ${duration}ms`, 'action', duration);
    return result;
  } catch (error: any) {
    const duration = Math.round(performance.now() - startTime);
    callbacks.onLog(`Error in ${name}: ${error.message}`, 'error', duration);
    callbacks.onSystem(`Error: ${error.message}`, { 
      name, 
      filename: args.filename || 'unknown', 
      error: error.message 
    });
    throw error;
  }
};
