
import { Type } from '@google/genai';
import { listDirectory, readFile, createFile, updateFile, editFile } from './mockFiles';

/**
 * Declarations for the AI model to understand available tools.
 */
export const COMMAND_DECLARATIONS = [
  { 
    name: 'list_directory', 
    description: 'Lists all available files in the current directory.' 
  },
  { 
    name: 'read_file', 
    description: 'Read the full content of a specified file. This sets the file as the active "Current Note".',
    parameters: { 
      type: Type.OBJECT, 
      properties: { 
        filename: { type: Type.STRING, description: 'The name of the file to read (e.g., first.md)' } 
      }, 
      required: ['filename'] 
    } 
  },
  { 
    name: 'create_file', 
    description: 'Create a new file with initial content.',
    parameters: { 
      type: Type.OBJECT, 
      properties: { 
        filename: { type: Type.STRING, description: 'Name of the file to create' }, 
        content: { type: Type.STRING, description: 'Content for the file' } 
      }, 
      required: ['filename', 'content'] 
    } 
  },
  { 
    name: 'update_file', 
    description: 'Overwrite the entire content of an existing file.',
    parameters: { 
      type: Type.OBJECT, 
      properties: { 
        filename: { type: Type.STRING }, 
        content: { type: Type.STRING } 
      }, 
      required: ['filename', 'content'] 
    } 
  },
  { 
    name: 'edit_file', 
    description: 'Perform granular line-based edits on a file.',
    parameters: { 
      type: Type.OBJECT, 
      properties: { 
        filename: { type: Type.STRING }, 
        operation: { 
          type: Type.STRING, 
          enum: ['append', 'replace_line', 'remove_line'],
          description: 'Type of edit operation'
        }, 
        text: { type: Type.STRING, description: 'Text for append or replace' }, 
        lineNumber: { type: Type.NUMBER, description: 'Line number for replace or remove (1-indexed)' } 
      }, 
      required: ['filename', 'operation'] 
    } 
  },
  { 
    name: 'close_view', 
    description: 'Closes any currently open file preview or diff popup on the user screen.' 
  }
];

/**
 * Dispatcher for executing commands and managing UI side-effects like diff views.
 */
export const executeCommand = async (
  name: string, 
  args: any, 
  callbacks: {
    onLog: (msg: string, type: 'action' | 'error') => void,
    onSystem: (text: string) => void,
    onDiff: (diff: { filename: string, old: string, new: string } | null) => void,
    onFileState: (folder: string, note: string | null) => void
  }
): Promise<any> => {
  try {
    let result: any = "ok";
    
    switch (name) {
      case 'list_directory':
        const files = listDirectory();
        result = { files };
        callbacks.onSystem(`[System: Listed ${files.length} files]`);
        break;

      case 'read_file':
        const content = readFile(args.filename);
        result = { content };
        callbacks.onDiff({ filename: args.filename, old: content, new: content });
        callbacks.onSystem(`[System: Opened ${args.filename}]`);
        callbacks.onFileState('/', args.filename);
        break;

      case 'create_file':
        await createFile(args.filename, args.content);
        callbacks.onDiff({ filename: args.filename, old: '', new: args.content });
        callbacks.onSystem(`[System: Created ${args.filename}]`);
        callbacks.onFileState('/', args.filename);
        break;

      case 'update_file':
        const oldContent = readFile(args.filename);
        await updateFile(args.filename, args.content);
        callbacks.onDiff({ filename: args.filename, old: oldContent, new: args.content });
        callbacks.onSystem(`[System: Updated ${args.filename}]`);
        break;

      case 'edit_file':
        const oldEditContent = readFile(args.filename);
        await editFile(args.filename, args.operation, args.text, args.lineNumber);
        const newEditContent = readFile(args.filename);
        callbacks.onDiff({ filename: args.filename, old: oldEditContent, new: newEditContent });
        callbacks.onSystem(`[System: Edited ${args.filename}]`);
        break;

      case 'close_view':
        callbacks.onDiff(null);
        callbacks.onSystem(`[System: Closed view]`);
        callbacks.onFileState('/', null);
        break;

      default:
        throw new Error(`Unknown command: ${name}`);
    }

    callbacks.onLog(`Command ${name} executed successfully.`, 'action');
    return result;

  } catch (error: any) {
    callbacks.onLog(`Command ${name} failed: ${error.message}`, 'error');
    throw error;
  }
};
