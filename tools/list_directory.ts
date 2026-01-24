
import { listDirectory } from '../services/mockFiles';
import { ToolData } from '../types';

export const declaration = {
  name: 'list_directory',
  description: 'Lists all available files in the current directory registry.'
};

export const instruction = `- list_directory: Use this to get an overview of the user's vault. Always call this if you are unsure of the available files.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const files = listDirectory();
  callbacks.onSystem(`Registry Scanned`, {
    name: 'list_directory',
    filename: 'Vault Root',
    files: files
  });
  return { files };
};
