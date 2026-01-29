import type { TAbstractFile, App } from 'obsidian';
import { TFile, normalizePath } from 'obsidian';
import { loadAppSettings } from '../persistence/persistence';
import { getObsidianApp } from '../utils/environment';
import { SearchResult, SearchMatch } from '../types';

const isFolder = (file: TAbstractFile): file is TAbstractFile & { children: TAbstractFile[] } => {
  return 'children' in file;
};

// Normalize folder paths by removing trailing slashes
const normalizeFolderPath = (path: string): string => {
  return path.endsWith('/') ? path.slice(0, -1) : path;
};

const getApp = (): App => {
  const app = getObsidianApp();
  if (!app) throw new Error('Obsidian app not available');
  return app;
};

export const initFileSystem = async () => {
  // No-op for Obsidian - vault is always ready
};

export const listDirectory = (): string[] => {
  const app = getApp();
  const allFiles = app.vault.getMarkdownFiles().map(f => f.path);
  return allFiles.filter(path => !path.startsWith('chat history/trash/'));
};

export interface VaultFileMeta {
  path: string;
  name: string;
  mtime: number;
  size: number;
}

export const getVaultFiles = (options: {
  limit?: number;
  offset?: number;
  sortBy?: 'mtime' | 'name' | 'size';
  sortOrder?: 'asc' | 'desc';
  filter?: string;
}): Promise<{ files: VaultFileMeta[]; total: number }> => {
  const { limit = 20, offset = 0, sortBy = 'mtime', sortOrder = 'desc', filter } = options;
  const app = getApp();

  let allFiles: VaultFileMeta[] = app.vault.getMarkdownFiles()
    .filter(f => !f.path.startsWith('chat history/trash/'))
    .map(f => ({
      path: f.path,
      name: f.name,
      mtime: f.stat.mtime,
      size: f.stat.size
    }));

  if (filter) {
    const f = filter.toLowerCase();
    allFiles = allFiles.filter(file => 
      file.path.toLowerCase().includes(f) || 
      file.name.toLowerCase().includes(f)
    );
  }

  allFiles.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    
    if (typeof valA === 'string' && typeof valB === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = allFiles.length;
  const paginated = allFiles.slice(offset, offset + limit);

  return Promise.resolve({ files: paginated, total });
};

export const getFolderTree = (folderPath?: string): string[] => {
  const app = getApp();
  const allFiles = app.vault.getAllLoadedFiles();
  
  // If folderPath is provided, filter files in that specific folder
  if (folderPath) {
    // Normalize path by removing trailing slashes
    const normalizedPath = normalizeFolderPath(folderPath);
    
    // Try the normalized path first
    let targetFolder = app.vault.getAbstractFileByPath(normalizePath(normalizedPath));
    
    // If not found, try the original path (in case it's a file)
    if (!targetFolder) {
      targetFolder = app.vault.getAbstractFileByPath(normalizePath(folderPath));
    }
    
    // If still not found, try adding a trailing slash (some edge cases)
    if (!targetFolder && !folderPath.endsWith('/')) {
      targetFolder = app.vault.getAbstractFileByPath(normalizePath(folderPath + '/'));
    }
    
    if (!targetFolder || !isFolder(targetFolder)) {
      // Provide more detailed error message for debugging
      const debugInfo = [
        `Original path: "${folderPath}"`,
        `Normalized path: "${normalizedPath}"`,
        `With trailing slash: "${folderPath + '/'}"`
      ].join(', ');
      throw new Error(`Folder not found: ${folderPath}. Attempted: ${debugInfo}`);
    }
    
    // Get all files (not just folders) in the specified folder
    return allFiles
      .filter((file) => {
        // Include files that are directly in the specified folder or its subfolders
        const basePath = normalizedPath || folderPath;
        return file.path.startsWith(basePath + '/') || file.path === basePath;
      })
      .map((file) => file.path)
      .sort();
  }
  
  // Original behavior: return all folders
  return allFiles
    .filter((file) => isFolder(file) && file.path !== 'chat history/trash')
    .map((file) => file.path)
    .sort();
};

type DirectoryNode = { path: string; children: DirectoryNode[] };

export const getDirectoryList = (): DirectoryNode[] => {
  const app = getApp();
  const allFiles = app.vault.getAllLoadedFiles();
  return allFiles
    .filter((file) => isFolder(file) && file.path !== 'chat history/trash')
    .map((file) => ({ path: file.path, children: [] }));
};

export const readFile = async (filename: string): Promise<string> => {
  const app = getApp();
  const file = app.vault.getAbstractFileByPath(normalizePath(filename));
  if (!file || !(file instanceof TFile)) throw new Error(`File not found in vault: ${filename}`);
  return await app.vault.read(file);
};

export const createBinaryFile = async (filename: string, data: ArrayBuffer | Uint8Array): Promise<string> => {
  const app = getApp();
  
  const dirPath = filename.substring(0, filename.lastIndexOf('/'));
  if (dirPath && dirPath.length > 0) {
    if (!(await app.vault.adapter.exists(dirPath))) {
      await app.vault.createFolder(dirPath);
    }
  }
  
  // Convert Uint8Array to ArrayBuffer if needed
  const buffer = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
  await app.vault.adapter.writeBinary(filename, buffer as ArrayBuffer);
  return `Created binary file ${filename} in vault`;
};

export const createFile = async (filename: string, content: string): Promise<string> => {
  const app = getApp();
  const normalizedFilename = normalizePath(filename);
  
  const dirPath = normalizedFilename.substring(0, normalizedFilename.lastIndexOf('/'));
  if (dirPath && dirPath.length > 0) {
    const folder = app.vault.getAbstractFileByPath(normalizePath(dirPath));
    if (!folder) {
      await app.vault.createFolder(dirPath);
    }
  }
  
  await app.vault.create(normalizedFilename, content);
  return `Created ${filename} in vault`;
};

export const updateFile = async (filename: string, content: string): Promise<string> => {
  const app = getApp();
  const file = app.vault.getAbstractFileByPath(normalizePath(filename));
  if (!file || !(file instanceof TFile)) throw new Error(`File not found: ${filename}`);
  await app.vault.modify(file, content);
  return `Updated ${filename} in vault`;
};

export const renameFile = async (oldFilename: string, newFilename: string): Promise<string> => {
  const app = getApp();
  const file = app.vault.getAbstractFileByPath(normalizePath(oldFilename));
  if (!file) throw new Error(`File not found: ${oldFilename}`);
  await app.fileManager.renameFile(file, normalizePath(newFilename));
  return `Renamed ${oldFilename} to ${newFilename} in vault`;
};

export const moveFile = async (sourcePath: string, targetPath: string): Promise<string> => {
  const app = getApp();
  const normalizedSource = normalizePath(sourcePath);
  const normalizedTarget = normalizePath(targetPath);
  const file = app.vault.getAbstractFileByPath(normalizedSource);
  if (!file) throw new Error(`Source file not found: ${sourcePath}`);
  
  const targetFile = app.vault.getAbstractFileByPath(normalizedTarget);
  if (targetFile) throw new Error(`Target file already exists: ${targetPath}`);
  
  await app.fileManager.renameFile(file, normalizedTarget);
  return `Moved ${sourcePath} to ${targetPath} in vault`;
};

export const editFile = async (filename: string, operation: string, text?: string, lineNumber?: number): Promise<string> => {
  const content = await readFile(filename);
  const lines = content.split('\n');

  if (operation === 'append') {
    lines.push(text || '');
  } else if (operation === 'replace_line') {
    if (lineNumber === undefined || lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(`Invalid line number: ${lineNumber}`);
    }
    lines[lineNumber - 1] = text || '';
  } else if (operation === 'remove_line') {
    if (lineNumber === undefined || lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(`Invalid line number: ${lineNumber}`);
    }
    lines.splice(lineNumber - 1, 1);
  } else {
    throw new Error(`Unknown operation: ${operation}`);
  }

  const newContent = lines.join('\n');
  await updateFile(filename, newContent);
  return `Successfully performed ${operation} on ${filename}`;
};

export const createDirectory = async (path: string): Promise<string> => {
  const app = getApp();
  const normalizedPath = normalizePath(normalizeFolderPath(path));
  const folder = app.vault.getAbstractFileByPath(normalizedPath);
  if (folder) {
    return `Directory ${normalizedPath} already exists`;
  }
  
  // Ensure parent directories exist
  const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
  if (parentPath && parentPath.length > 0) {
    const parentFolder = app.vault.getAbstractFileByPath(normalizePath(parentPath));
    if (!parentFolder) {
      await app.vault.createFolder(parentPath);
    }
  }
  
  await app.vault.createFolder(normalizedPath);
  return `Created directory ${normalizedPath} in vault`;
};

export const deleteFile = async (filename: string): Promise<string> => {
  const app = getApp();
  const file = app.vault.getAbstractFileByPath(normalizePath(filename));
  if (!file) throw new Error(`File not found: ${filename}`);
  
  const currentSettings = loadAppSettings();
  const chatHistoryFolder = currentSettings?.chatHistoryFolder || 'chat-history';
  
  const trashFolderPath = `${chatHistoryFolder}/trash`;
  const trashFolder = app.vault.getAbstractFileByPath(normalizePath(trashFolderPath));
  if (!trashFolder) {
    await app.vault.createFolder(trashFolderPath);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = filename.split('/').pop() || filename;
  const trashFilename = `${trashFolderPath}/${timestamp}-${fileName}`;
  
  await app.fileManager.renameFile(file, trashFilename);
  return `Moved ${filename} to trash`;
};

export const searchFiles = async (query: string, isRegex: boolean = false, flags: string = 'i'): Promise<SearchResult[]> => {
  const filenames = listDirectory();
  const results: SearchResult[] = [];

  const regex = isRegex ? new RegExp(query, flags) : null;
  const keyword = !isRegex ? query.toLowerCase() : '';

  for (const filename of filenames) {
    const content = await readFile(filename);
    const lines = content.split('\n');
    const matches: SearchMatch[] = [];

    lines.forEach((line, index) => {
      let matched = false;
      if (isRegex && regex) {
        matched = regex.test(line);
      } else {
        matched = line.toLowerCase().includes(keyword);
      }

      if (matched) {
        matches.push({
          line: index + 1,
          content: line,
          contextBefore: lines.slice(Math.max(0, index - 2), index),
          contextAfter: lines.slice(index + 1, Math.min(lines.length, index + 3))
        });
      }
    });

    if (matches.length > 0) {
      results.push({ filename, matches });
    }
  }

  return results;
};
