
import { Type } from '@google/genai';
import { searchFiles } from '../services/mockFiles';

export const declaration = {
  name: 'search_regexp',
  description: 'Search using a regular expression across all files.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      pattern: { type: Type.STRING, description: 'The regex pattern' },
      flags: { type: Type.STRING, description: 'Optional regex flags (default: "i")' }
    },
    required: ['pattern']
  }
};

export const instruction = `- search_regexp: Advanced regex search. Use this to identify files for global replacements.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const results = await searchFiles(args.pattern, true, args.flags || 'i');
  callbacks.onSystem(`Regex search complete for /${args.pattern}/`, {
    name: 'search_regexp',
    filename: 'Regex Search',
    searchResults: results
  });
  return { results };
};
