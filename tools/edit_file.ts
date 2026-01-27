
import { Type } from '@google/genai';
import { readFile, editFile } from '../services/mockFiles';
import { getDirectoryFromPath, openFile } from '../utils/environment';

export const declaration = {
  name: 'edit_file',
  description: 'Perform granular line-based edits on a file.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING },
      operation: { 
        type: Type.STRING, 
        enum: ['append', 'replace_line', 'remove_line']
      }, 
      text: { type: Type.STRING }, 
      lineNumber: { type: Type.NUMBER }
    },
    required: ['filename', 'operation']
  }
};

export const instruction = `- edit_file: Use this for targeted modifications (appending, replacing lines, or removing lines).`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const oldContent = await readFile(args.filename).catch(() => '');
  await editFile(args.filename, args.operation, args.text, args.lineNumber);
  const newContent = await readFile(args.filename);

  // Open the edited file in Obsidian using smart tab management
  await openFile(args.filename);

  callbacks.onSystem(`Edited ${args.filename}`, {
    name: 'edit_file',
    filename: args.filename,
    oldContent,
    newContent,
    additions: args.operation === 'append' ? 1 : (args.operation === 'replace_line' ? 1 : 0),
    removals: args.operation === 'remove_line' ? 1 : (args.operation === 'replace_line' ? 1 : 0)
  });
  const fileDirectory = getDirectoryFromPath(args.filename);
  callbacks.onFileState(fileDirectory, args.filename);
  return { status: 'edited' };
};
