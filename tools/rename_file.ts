
import { Type } from '@google/genai';
import { renameFile } from '../services/mockFiles';
import { getDirectoryFromPath, openFileInObsidian } from '../utils/environment';

export const declaration = {
  name: 'rename_file',
  description: 'Rename an existing file to a new name.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      oldFilename: { type: Type.STRING, description: 'The current name of the file' },
      newFilename: { type: Type.STRING, description: 'The new name for the file' }
    },
    required: ['oldFilename', 'newFilename']
  }
};

export const instruction = `- rename_file: Use this to change the name of a note. Ensure the new name follows markdown extension conventions if applicable.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  await renameFile(args.oldFilename, args.newFilename);
  
  // Open the renamed file in Obsidian
  await openFileInObsidian(args.newFilename);
  
  callbacks.onSystem(`Renamed ${args.oldFilename} to ${args.newFilename}`, {
    name: 'rename_file',
    filename: args.oldFilename,
    oldContent: args.oldFilename,
    newContent: args.newFilename
  });
  const newFileDirectory = getDirectoryFromPath(args.newFilename);
  callbacks.onFileState(newFileDirectory, args.newFilename);
  return { status: 'renamed', from: args.oldFilename, to: args.newFilename };
};
