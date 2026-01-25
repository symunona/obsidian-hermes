import { Type } from '@google/genai';
import { moveFile } from '../services/mockFiles';
import { openFileInObsidian } from '../utils/environment';

export const declaration = {
  name: 'move_file',
  description: 'Move a file from one folder to another using paths relative to vault root',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sourcePath: {
        type: Type.STRING,
        description: 'Current path relative to vault root (e.g., "projects/notes.md" or "notes.md" for root level)'
      },
      targetPath: {
        type: Type.STRING, 
        description: 'New path relative to vault root (e.g., "archive/projects/notes.md" or "notes.md" for root level)'
      }
    },
    required: ['sourcePath', 'targetPath']
  }
};

export const instruction = `- move_file: Move a file using paths relative to vault root. All paths are relative to vault root (e.g., "projects/notes.md" or "notes.md" for root level files). Use this to reorganize files between folders.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const result = await moveFile(args.sourcePath, args.targetPath);
  
  // Open the file at its new location in Obsidian
  await openFileInObsidian(args.targetPath);
  
  callbacks.onSystem(`Moved ${args.sourcePath} to ${args.targetPath}`, {
    name: 'move_file',
    filename: args.sourcePath,
    oldContent: args.sourcePath,
    newContent: args.targetPath
  });
  return { status: 'moved', from: args.sourcePath, to: args.targetPath };
};
