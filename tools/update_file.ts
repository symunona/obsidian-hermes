
import { Type } from '@google/genai';
import { readFile, updateFile } from '../services/mockFiles';

export const declaration = {
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
};

export const instruction = `- update_file: Use this for total overwrites. For smaller changes, prefer edit_file.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const oldContent = await readFile(args.filename).catch(() => '');
  await updateFile(args.filename, args.content);
  
  const oldLines = oldContent.split('\n');
  const newLines = args.content.split('\n');
  const additions = newLines.filter(l => !oldLines.includes(l)).length;
  const removals = oldLines.filter(l => !newLines.includes(l)).length;

  callbacks.onSystem(`Updated ${args.filename}`, {
    name: 'update_file',
    filename: args.filename,
    oldContent,
    newContent: args.content,
    additions,
    removals
  });
  callbacks.onFileState('/', args.filename);
  return { status: 'updated' };
};
