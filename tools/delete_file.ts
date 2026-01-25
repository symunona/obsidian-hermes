import { Type } from '@google/genai';
import { deleteFile } from '../services/mockFiles';
import { getDirectoryFromPath } from '../utils/environment';

export const declaration = {
  name: 'delete_file',
  description: 'Move an existing file from the vault to the trash folder (chat history/trash). Files in trash are hidden from directory listings.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING, description: 'Path relative to vault root (e.g., "projects/notes.md" or "notes.md" for root level)' }
    },
    required: ['filename']
  }
};

export const instruction = `- delete_file: Use this to move a note to the trash folder (chat history/trash). Files in trash are hidden from directory listings but can be recovered manually. All paths are relative to vault root.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  await deleteFile(args.filename);
  callbacks.onSystem(`Moved ${args.filename} to trash`, {
    name: 'delete_file',
    filename: args.filename,
    oldContent: args.filename,
    newContent: ''
  });
  const fileDirectory = getDirectoryFromPath(args.filename);
  callbacks.onFileState(fileDirectory, null);
  return { status: 'moved_to_trash', filename: args.filename };
};
