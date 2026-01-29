import { Type } from '@google/genai';
import { getObsidianApp, getDirectoryFromPath, openFileInObsidian } from '../utils/environment';
import { loadAppSettings } from '../persistence/persistence';
import type { ToolCallbacks } from '../types';
import { getErrorMessage } from '../utils/getErrorMessage';

type ToolArgs = Record<string, unknown>;

const getStringArg = (args: ToolArgs, key: string): string | undefined => {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
};

export const declaration = {
  name: 'restore_from_trash',
  description: 'Restore a file from the trash folder to its original location or a specified location.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      trash_filename: { type: Type.STRING, description: 'The filename in trash (as shown by list_trash, e.g., "2024-01-25T15-30-45-123Z-my-note.md")' },
      target_path: { type: Type.STRING, description: 'Optional: Target path where to restore the file. If not provided, attempts to restore to original location.' }
    },
    required: ['trash_filename']
  }
};

export const instruction = `- restore_from_trash: Use this to restore a file from trash. Provide the trash filename from list_trash. Optionally specify where to restore it.`;

export const execute = async (args: ToolArgs, callbacks: ToolCallbacks): Promise<unknown> => {
  const app = getObsidianApp();
  
  if (!app || !app.vault) {
    callbacks.onSystem('Error: Not running in Obsidian or vault unavailable', {
      name: 'restore_from_trash',
      filename: 'Trash',
      error: 'Obsidian vault not available'
    });
    return { error: 'Obsidian vault not available' };
  }

  const trashFilename = getStringArg(args, 'trash_filename');
  const targetPathArg = getStringArg(args, 'target_path');

  if (!trashFilename) {
    callbacks.onSystem('Error: trash_filename is required', {
      name: 'restore_from_trash',
      filename: 'Trash',
      status: 'error',
      error: 'Missing required parameter: trash_filename'
    });
    return { error: 'trash_filename is required' };
  }

  try {
    callbacks.onSystem(`Restoring ${trashFilename}...`, {
      name: 'restore_from_trash',
      filename: trashFilename,
      status: 'pending'
    });

    // Get current settings to access chatHistoryFolder
    const currentSettings = loadAppSettings();
    const chatHistoryFolder = currentSettings?.chatHistoryFolder || 'chat-history';
    const trashFolderPath = `${chatHistoryFolder}/trash`;

    // Find the file in trash
    const trashFilePath = trashFilename.includes('/') ? trashFilename : `${trashFolderPath}/${trashFilename}`;
    const trashFile = app.vault.getAbstractFileByPath(trashFilePath);
    
    if (!trashFile) {
      callbacks.onSystem(`File not found in trash: ${trashFilename}`, {
        name: 'restore_from_trash',
        filename: trashFilename,
        status: 'error',
        error: 'File not found in trash'
      });
      return { error: `File not found in trash: ${trashFilename}` };
    }

    // Extract original filename from trash filename
    const originalFilename = extractOriginalName(trashFile.name);
    
    // Determine target path
    let restorePath = targetPathArg;
    if (!restorePath) {
      // Try to determine original location from the filename
      restorePath = originalFilename;
      
      // If the original filename includes subdirectories, try to restore there
      if (originalFilename.includes('/')) {
        const targetDir = getDirectoryFromPath(originalFilename);
        // Ensure target directory exists
        const targetFolder = app.vault.getAbstractFileByPath(targetDir);
        if (!targetFolder) {
          await app.vault.createFolder(targetDir);
        }
      }
    }

    // Check if target file already exists
    const existingFile = app.vault.getAbstractFileByPath(restorePath);
    if (existingFile) {
      callbacks.onSystem(`Target file already exists: ${restorePath}`, {
        name: 'restore_from_trash',
        filename: trashFilename,
        status: 'error',
        error: 'Target file already exists',
        targetPath: restorePath
      });
      return { 
        error: `Target file already exists: ${restorePath}. Please specify a different target_path or delete the existing file first.`,
        targetPath: restorePath,
        trashPath: trashFilePath
      };
    }

    // Move file from trash to target location
    await app.fileManager.renameFile(trashFile, restorePath);

    // Open the restored file in Obsidian
    await openFileInObsidian(restorePath);

    callbacks.onSystem(`Successfully restored ${originalFilename} to ${restorePath}`, {
      name: 'restore_from_trash',
      filename: originalFilename,
      status: 'success',
      originalPath: trashFilePath,
      restoredPath: restorePath
    });

    const fileDirectory = getDirectoryFromPath(restorePath);
    callbacks.onFileState(fileDirectory, originalFilename);

    return {
      success: true,
      originalFilename,
      trashPath: trashFilePath,
      restoredPath: restorePath,
      message: `Successfully restored ${originalFilename} to ${restorePath}`
    };

  } catch (error) {
    console.error('Restore from trash error:', error);
    callbacks.onSystem('Error restoring file from trash', {
      name: 'restore_from_trash',
      filename: trashFilename,
      status: 'error',
      error: getErrorMessage(error)
    });
    return { error: getErrorMessage(error) };
  }
};

// Helper function to extract original filename from trash filename
function extractOriginalName(trashFilename: string): string {
  // Trash filename format: timestamp-original-name.md
  const match = trashFilename.match(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-(.+)$/);
  if (match) {
    return match[1];
  }
  
  // Fallback for older formats or different patterns
  const altMatch = trashFilename.match(/^\d+-(.+)$/);
  if (altMatch) {
    return altMatch[1];
  }
  
  return trashFilename;
}
