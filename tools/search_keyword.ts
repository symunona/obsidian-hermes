
import { Type } from '@google/genai';
import { searchFiles } from '../services/mockFiles';

export const declaration = {
  name: 'search_keyword',
  description: 'Search for a keyword across all files in the vault.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      keyword: { type: Type.STRING, description: 'The text to search for' }
    },
    required: ['keyword']
  }
};

export const instruction = `- search_keyword: Fast plaintext search across all files.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const results = await searchFiles(args.keyword, false);
  callbacks.onSystem(`Search complete for "${args.keyword}"`, {
    name: 'search_keyword',
    filename: 'Global Search',
    searchResults: results
  });
  return { results };
};
