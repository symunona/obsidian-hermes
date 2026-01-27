import { Type } from '@google/genai';
import { createDirectory } from '../services/mockFiles';
import { getDirectoryFromPath } from '../utils/environment';

export const declaration = {
  name: 'create_directory',
  description: 'Create a new directory in the vault. Parent directories will be created automatically if they don\'t exist.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: 'Directory path relative to vault root (e.g., "projects/notes" or "archive" for root level)' }
    },
    required: ['path']
  }
};

export const instruction = `- create_directory: Use this to create new directories in the vault. All paths are relative to vault root. Parent directories are created automatically.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  await createDirectory(args.path);
  const dirName = args.path.split('/').pop() || args.path;
  const parentPath = args.path.replace(/[^\/]+$/, '');
  
  callbacks.onSystem(`Created directory ${args.path}`, {
    name: 'create_directory',
    filename: args.path,
    displayFormat: `${parentPath}<span style="color: #10b981; font-weight: 600;">${dirName}</span>`,
    dropdown: false
  });
  // Don't automatically open the newly created directory
  // callbacks.onFileState(directoryPath, args.path);
  return { status: 'created', path: args.path };
};
