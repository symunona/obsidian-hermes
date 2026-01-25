
import { Type } from '@google/genai';
import { getVaultFiles } from '../services/mockFiles';

export const declaration = {
  name: 'list_vault_files',
  description: 'Lists markdown files in the vault with pagination and sorting. Essential for large vaults.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: { type: Type.NUMBER, description: 'Max number of files to return (default: 20)' },
      offset: { type: Type.NUMBER, description: 'Number of files to skip (default: 0)' },
      sortBy: { 
        type: Type.STRING, 
        enum: ['mtime', 'name', 'size'],
        description: 'Property to sort by. mtime is last modified time.'
      },
      sortOrder: { 
        type: Type.STRING, 
        enum: ['asc', 'desc'],
        description: 'Sort order (default: desc)'
      },
      filter: { 
        type: Type.STRING, 
        description: 'Optional text filter for path or filename.' 
      }
    }
  }
};

export const instruction = `- list_vault_files: Use this to explore large vaults. It supports paging and sorting. Default is most recently modified first.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const { limit, offset, sortBy, sortOrder, filter } = args;
  const result = await getVaultFiles({ limit, offset, sortBy, sortOrder, filter });
  
  const displayNames = result.files.map(f => f.path);
  
  callbacks.onSystem(`Vault Files (${offset}-${offset + result.files.length} of ${result.total})`, {
    name: 'list_vault_files',
    filename: 'Vault Explorer',
    files: displayNames
  });
  
  return result;
};
