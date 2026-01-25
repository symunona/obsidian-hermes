
import { getFolderTree } from '../services/mockFiles';

export const declaration = {
  name: 'get_folder_tree',
  description: 'Lists all folders in the vault to understand hierarchy.'
};

export const instruction = `- get_folder_tree: Use this to see the organization of folders in the vault.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const folders = getFolderTree();
  callbacks.onSystem(`Folder Structure Scanned`, {
    name: 'get_folder_tree',
    filename: 'Folder Tree',
    files: folders
  });
  return { folders };
};
