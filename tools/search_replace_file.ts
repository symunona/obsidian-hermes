
import { Type } from '@google/genai';
import { readFile, updateFile } from '../services/mockFiles';

export const declaration = {
  name: 'search_and_replace_regex_in_file',
  description: 'Search and replace text in a specific file using regex.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING },
      pattern: { type: Type.STRING },
      replacement: { type: Type.STRING },
      flags: { type: Type.STRING, description: 'Optional regex flags (default: "g")' }
    },
    required: ['filename', 'pattern', 'replacement']
  }
};

export const instruction = `- search_and_replace_regex_in_file: Targeted regex replacement within a single node.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const oldContent = await readFile(args.filename);
  const re = new RegExp(args.pattern, args.flags || 'g');
  const newContent = oldContent.replace(re, args.replacement);
  await updateFile(args.filename, newContent);

  callbacks.onSystem(`Replaced in ${args.filename}`, {
    name: 'search_and_replace_regex_in_file',
    filename: args.filename,
    oldContent,
    newContent,
    additions: 1, // Simplified
    removals: 1   // Simplified
  });
  callbacks.onFileState('/', args.filename);
  return { status: 'success' };
};
