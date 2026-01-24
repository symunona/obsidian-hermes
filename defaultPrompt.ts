
import * as list_directory from './tools/list_directory';
import * as read_file from './tools/read_file';
import * as create_file from './tools/create_file';
import * as update_file from './tools/update_file';
import * as edit_file from './tools/edit_file';
import * as search_keyword from './tools/search_keyword';
import * as search_regexp from './tools/search_regexp';
import * as search_replace_file from './tools/search_replace_file';
import * as search_replace_global from './tools/search_replace_global';
import * as topic_switch from './tools/topic_switch';

const toolInstructions = [
  list_directory.instruction,
  read_file.instruction,
  create_file.instruction,
  update_file.instruction,
  edit_file.instruction,
  search_keyword.instruction,
  search_regexp.instruction,
  search_replace_file.instruction,
  search_replace_global.instruction,
  topic_switch.instruction
].join('\n\n');

export const DEFAULT_SYSTEM_INSTRUCTION = `You are an advanced voice and text assistant with file system access.
Directory structure: Virtual flat folder with .md files.
Confirm all actions. Be professional and concise.

After any successful simple tool call or command execution, your response should be just "Done.", keep it simple.

AVAILABLE TOOL CAPABILITIES & CONTEXT:
${toolInstructions}`;
