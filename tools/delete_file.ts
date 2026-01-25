import { Type } from '@google/genai';
import { deleteFile } from '../services/mockFiles';
import { getDirectoryFromPath } from '../utils/environment';

export const declaration = {
  name: 'delete_file',
  description: 'Delete an existing file from the vault.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING, description: 'Path relative to vault root (e.g., "projects/notes.md" or "notes.md" for root level)' }
    },
    required: ['filename']
  }
};

export const instruction = `- delete_file: Use this to permanently remove a note from the vault. All paths are relative to vault root. This action cannot be undone.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  await deleteFile(args.filename);
  callbacks.onSystem(`Deleted ${args.filename}`, {
    name: 'delete_file',
    filename: args.filename,
    oldContent: args.filename,
    newContent: ''
  });
  const fileDirectory = getDirectoryFromPath(args.filename);
  callbacks.onFileState(fileDirectory, null);
  return { status: 'deleted', filename: args.filename };
};
