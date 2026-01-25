
import { Type } from '@google/genai';
import { createFile } from '../services/mockFiles';
import { getDirectoryFromPath, openFileInObsidian } from '../utils/environment';

export const declaration = {
  name: 'create_file',
  description: 'Create a new file with initial content using path relative to vault root.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING, description: 'Path relative to vault root (e.g., "projects/notes.md" or "notes.md" for root level)' },
      content: { type: Type.STRING }
    },
    required: ['filename', 'content']
  }
};

export const instruction = `- create_file: Use this to initialize new notes in the vault. All paths are relative to vault root (e.g., "projects/notes.md" or "notes.md" for root level). Always provide meaningful initial content.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  await createFile(args.filename, args.content);
  
  // Open the newly created file in Obsidian
  await openFileInObsidian(args.filename);
  
  callbacks.onSystem(`Created ${args.filename}`, {
    name: 'create_file',
    filename: args.filename,
    oldContent: '',
    newContent: args.content,
    additions: args.content.split('\n').length,
    removals: 0
  });
  const fileDirectory = getDirectoryFromPath(args.filename);
  callbacks.onFileState(fileDirectory, args.filename);
  return { status: 'created' };
};
