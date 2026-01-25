import { Type } from '@google/genai';
import { getObsidianApp } from '../utils/environment';
import { loadAppSettings } from '../persistence/persistence';

export const declaration = {
  name: 'list_trash',
  description: 'List the most recent files in the trash folder. Shows up to 100 files sorted by deletion time (most recent first).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: { type: Type.NUMBER, description: 'Maximum number of files to show (default: 20, max: 100).' }
    }
  }
};

export const instruction = `- list_trash: Use this to list files in the trash folder. Shows recently deleted files that can be restored.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const app = getObsidianApp();
  
  if (!app || !app.vault) {
    callbacks.onSystem('Error: Not running in Obsidian or vault unavailable', {
      name: 'list_trash',
      filename: 'Trash',
      error: 'Obsidian vault not available'
    });
    return { error: 'Obsidian vault not available' };
  }

  const { limit = 20 } = args;
  const maxLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);

  try {
    callbacks.onSystem('Scanning trash folder...', {
      name: 'list_trash',
      filename: 'Trash',
      status: 'pending'
    });

    // Get current settings to access chatHistoryFolder
    const currentSettings = loadAppSettings() as any;
    const chatHistoryFolder = currentSettings?.chatHistoryFolder || 'chat-history';
    const trashFolderPath = `${chatHistoryFolder}/trash`;

    // Check if trash folder exists
    const trashFolder = app.vault.getAbstractFileByPath(trashFolderPath);
    if (!trashFolder) {
      callbacks.onSystem('Trash folder is empty or does not exist', {
        name: 'list_trash',
        filename: 'Trash',
        status: 'success',
        files: []
      });
      return { files: [], total: 0, message: 'Trash folder is empty' };
    }

    // Get all files in trash folder
    const allTrashFiles = app.vault.getMarkdownFiles()
      .filter(file => file.path.startsWith(trashFolderPath + '/'))
      .map(file => ({
        path: file.path,
        name: file.name,
        originalName: extractOriginalName(file.name),
        trashTimestamp: extractTimestamp(file.name),
        deletionDate: parseTimestamp(extractTimestamp(file.name)),
        size: file.stat.size,
        mtime: file.stat.mtime
      }))
      .filter(file => file.trashTimestamp !== null) // Only include files with timestamp format
      .sort((a, b) => {
        // Sort by timestamp (most recent first)
        const timeA = a.deletionDate?.getTime() || 0;
        const timeB = b.deletionDate?.getTime() || 0;
        return timeB - timeA;
      });

    const totalFiles = allTrashFiles.length;
    const filesToShow = allTrashFiles.slice(0, maxLimit);

    // Format files for display
    const formattedFiles = filesToShow.map(file => ({
      trashPath: file.path,
      originalName: file.originalName,
      trashFilename: file.name,
      deletionDate: file.deletionDate?.toISOString() || '',
      formattedDeletionDate: file.deletionDate?.toLocaleString() || '',
      size: file.size,
      canRestore: true
    }));

    callbacks.onSystem(`Found ${totalFiles} files in trash${totalFiles > maxLimit ? ` (showing ${maxLimit} most recent)` : ''}`, {
      name: 'list_trash',
      filename: 'Trash',
      status: 'success',
      files: formattedFiles,
      total: totalFiles,
      shown: formattedFiles.length
    });

    return {
      files: formattedFiles,
      total: totalFiles,
      shown: formattedFiles.length,
      trashFolderPath
    };

  } catch (error) {
    callbacks.onSystem('Error listing trash files', {
      name: 'list_trash',
      filename: 'Trash',
      status: 'error',
      error: error.message || String(error)
    });
    return { error: error.message || String(error) };
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

// Helper function to extract timestamp from trash filename
function extractTimestamp(trashFilename: string): string | null {
  // Try ISO format first: 2024-01-25T15-30-45-123Z-original-name.md
  const isoMatch = trashFilename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-/);
  if (isoMatch) {
    return isoMatch[1].replace(/-/g, ':').replace('T', 'T').replace(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z/, '$1T$2:$3:$4.$5Z');
  }
  
  // Try simple timestamp format: 1643107845-original-name.md
  const simpleMatch = trashFilename.match(/^(\d{13})-/);
  if (simpleMatch) {
    return simpleMatch[1];
  }
  
  return null;
}

// Helper function to parse timestamp into Date
function parseTimestamp(timestamp: string | null): Date | null {
  if (!timestamp) return null;
  
  try {
    // Try ISO format
    if (timestamp.includes('T') && timestamp.includes('Z')) {
      return new Date(timestamp);
    }
    
    // Try Unix timestamp (milliseconds)
    if (/^\d{13}$/.test(timestamp)) {
      return new Date(parseInt(timestamp));
    }
    
    return null;
  } catch {
    return null;
  }
}
