
import { loadFiles, saveFiles } from './persistence';
import { SearchResult, SearchMatch } from '../types';

import { isObsidian, getObsidianApp } from '../utils/environment';

// Check if we are running inside Obsidian
const inObsidian = isObsidian();

const DEFAULT_FILES: Record<string, string> = {
  'first.md': `Green leaves in the wind,
Softly dancing on the branch,
Nature's quiet song.`,
  'second.md': `Golden sun descends,
Painting clouds in fire light,
Day turns into night.`,
  'third.md': `Winter's cold embrace,
Snowflakes drift on silent air,
World is white and still.`,
  'projects/ideas.md': `# Project Ideas
- Voice controlled vault
- Markdown visualizer
- AI Haiku generator`,
  'projects/tasks.md': `# Task List
- [ ] Implement rename tool
- [ ] Fix markdown rendering
- [ ] Add batch action logic`,
  'projects/notes.md': `# Research Notes
Vaults are better when they are interactive. Hermes is the messenger.`
};

let MOCK_FILES: Record<string, string> = { ...DEFAULT_FILES };
let initialized = false;

export const initFileSystem = async () => {
  if (initialized) return;
  if (inObsidian) {
    initialized = true;
    return;
  }
  const persisted = await loadFiles();
  if (persisted) {
    MOCK_FILES = persisted;
  } else {
    await saveFiles(DEFAULT_FILES);
  }
  initialized = true;
};

export const listDirectory = (): string[] => {
  if (inObsidian) {
    // @ts-ignore
    const allFiles = getObsidianApp().vault.getMarkdownFiles().map(f => f.path);
    // Filter out files in trash folder
    return allFiles.filter(path => !path.startsWith('chat history/trash/'));
  }
  return Object.keys(MOCK_FILES);
};

export interface VaultFileMeta {
  path: string;
  name: string;
  mtime: number;
  size: number;
}

/**
 * Smart Pager for Vault Files
 * Fetches markdown files with sorting, filtering, and pagination.
 */
export const getVaultFiles = async (options: {
  limit?: number;
  offset?: number;
  sortBy?: 'mtime' | 'name' | 'size';
  sortOrder?: 'asc' | 'desc';
  filter?: string;
}): Promise<{ files: VaultFileMeta[]; total: number }> => {
  const { limit = 20, offset = 0, sortBy = 'mtime', sortOrder = 'desc', filter } = options;

  let allFiles: VaultFileMeta[] = [];

  if (inObsidian) {
    // @ts-ignore
    const allVaultFiles = getObsidianApp().vault.getMarkdownFiles().map(f => ({
      path: f.path,
      name: f.name,
      mtime: f.stat.mtime,
      size: f.stat.size
    }));
    // Filter out files in trash folder
    allFiles = allVaultFiles.filter(file => !file.path.startsWith('chat history/trash/'));
  } else {
    allFiles = Object.keys(MOCK_FILES).map(path => ({
      path,
      name: path.split('/').pop() || path,
      mtime: Date.now(), // Mock time
      size: MOCK_FILES[path].length * 2 // Rough byte size
    }));
  }

  // Filter
  if (filter) {
    const f = filter.toLowerCase();
    allFiles = allFiles.filter(file => 
      file.path.toLowerCase().includes(f) || 
      file.name.toLowerCase().includes(f)
    );
  }

  // Sort
  allFiles.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    
    if (typeof valA === 'string') {
      valA = (valA as string).toLowerCase();
      valB = (valB as string).toLowerCase();
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = allFiles.length;
  const paginated = allFiles.slice(offset, offset + limit);

  return { files: paginated, total };
};

/**
 * Retrieves the folder structure of the vault.
 */
export const getFolderTree = (): string[] => {
  if (inObsidian) {
    // @ts-ignore
    const allFiles = getObsidianApp().vault.getAllLoadedFiles();
    // @ts-ignore
    return allFiles.filter((f: any) => f.children !== undefined && f.path !== 'chat history/trash').map((f: any) => f.path).sort();
  } else {
    const paths = Object.keys(MOCK_FILES);
    const folders = new Set<string>();
    paths.forEach(p => {
      const parts = p.split('/');
      parts.pop(); // Remove filename
      let current = '';
      parts.forEach(part => {
        current += (current ? '/' : '') + part;
        folders.add(current);
      });
    });
    return Array.from(folders).sort();
  }
};

/**
 * Retrieves only directory structure, ignoring files completely.
 * Returns a hierarchical tree structure of directories.
 */
export const getDirectoryList = (): { path: string; children: any[] }[] => {
  if (inObsidian) {
    // @ts-ignore
    const allFiles = getObsidianApp().vault.getAllLoadedFiles();
    // @ts-ignore
    return allFiles.filter((f: any) => f.children !== undefined && f.path !== 'chat history/trash').map((f: any) => ({ path: f.path, children: [] }));
  } else {
    // Mock implementation for non-Obsidian environment
    const paths = Object.keys(MOCK_FILES);
    const folderMap = new Map<string, Set<string>>();
    
    // Build folder relationships
    paths.forEach(p => {
      const parts = p.split('/');
      parts.pop(); // Remove filename
      
      for (let i = 0; i < parts.length; i++) {
        const currentPath = parts.slice(0, i + 1).join('/');
        const parentPath = i === 0 ? '/' : parts.slice(0, i).join('/');
        
        if (!folderMap.has(parentPath)) {
          folderMap.set(parentPath, new Set());
        }
        folderMap.get(parentPath)!.add(currentPath);
      }
    });
    
    const buildTree = (path: string): any => {
      const children = Array.from(folderMap.get(path) || [])
        .map(childPath => buildTree(childPath))
        .sort((a, b) => a.path.localeCompare(b.path));
      
      return {
        path: path === '/' ? '' : path,
        children
      };
    };
    
    return [buildTree('/')];
  }
};

export const readFile = async (filename: string): Promise<string> => {
  if (inObsidian) {
    // @ts-ignore
    const file = getObsidianApp().vault.getAbstractFileByPath(filename);
    if (!file) throw new Error(`File not found in vault: ${filename}`);
    // @ts-ignore
    return await getObsidianApp().vault.read(file);
  }

  const content = MOCK_FILES[filename.toLowerCase()];
  if (!content) {
    throw new Error(`File not found: ${filename}`);
  }
  return content;
};

export const createBinaryFile = async (filename: string, data: ArrayBuffer | Buffer): Promise<string> => {
  if (inObsidian) {
    // Extract directory path from filename
    const dirPath = filename.substring(0, filename.lastIndexOf('/'));
    if (dirPath && dirPath.length > 0) {
      // Check if directory exists, create if it doesn't
      // @ts-ignore
      const folder = getObsidianApp().vault.getAbstractFileByPath(dirPath);
      if (!folder) {
        // @ts-ignore
        await getObsidianApp().vault.createFolder(dirPath);
      }
    }
    
    // @ts-ignore
    await getObsidianApp().vault.createBinary(filename, data);
    return `Created binary file ${filename} in vault`;
  }

  // For development/testing environment, create a placeholder file
  const placeholder = `[Binary file data - ${data.byteLength || (data as Buffer).length} bytes]\n\nThis would be a binary file (${filename}) in the Obsidian environment.`;
  return await createFile(filename, placeholder);
};

export const createFile = async (filename: string, content: string): Promise<string> => {
  if (inObsidian) {
    // Extract directory path from filename
    const dirPath = filename.substring(0, filename.lastIndexOf('/'));
    if (dirPath && dirPath.length > 0) {
      // Check if directory exists, create if it doesn't
      // @ts-ignore
      const folder = getObsidianApp().vault.getAbstractFileByPath(dirPath);
      if (!folder) {
        // @ts-ignore
        await getObsidianApp().vault.createFolder(dirPath);
      }
    }
    
    // @ts-ignore
    await getObsidianApp().vault.create(filename, content);
    return `Created ${filename} in vault`;
  }

  const key = filename.toLowerCase();
  if (MOCK_FILES[key]) {
    throw new Error(`File already exists: ${filename}`);
  }
  MOCK_FILES[key] = content;
  await saveFiles(MOCK_FILES);
  return `Successfully created ${filename}`;
};

export const updateFile = async (filename: string, content: string): Promise<string> => {
  if (inObsidian) {
    // @ts-ignore
    const file = getObsidianApp().vault.getAbstractFileByPath(filename);
    if (!file) throw new Error(`File not found: ${filename}`);
    // @ts-ignore
    await getObsidianApp().vault.modify(file, content);
    return `Updated ${filename} in vault`;
  }

  const key = filename.toLowerCase();
  if (!MOCK_FILES[key]) {
    throw new Error(`File not found: ${filename}`);
  }
  MOCK_FILES[key] = content;
  await saveFiles(MOCK_FILES);
  return `Successfully updated ${filename}`;
};

export const renameFile = async (oldFilename: string, newFilename: string): Promise<string> => {
  if (inObsidian) {
    // @ts-ignore
    const file = getObsidianApp().vault.getAbstractFileByPath(oldFilename);
    if (!file) throw new Error(`File not found: ${oldFilename}`);
    // @ts-ignore
    await getObsidianApp().fileManager.renameFile(file, newFilename);
    return `Renamed ${oldFilename} to ${newFilename} in vault`;
  }

  const oldKey = oldFilename.toLowerCase();
  const newKey = newFilename.toLowerCase();
  
  if (!MOCK_FILES[oldKey]) {
    throw new Error(`File not found: ${oldFilename}`);
  }
  if (MOCK_FILES[newKey]) {
    throw new Error(`File already exists: ${newFilename}`);
  }
  
  const content = MOCK_FILES[oldKey];
  delete MOCK_FILES[oldKey];
  MOCK_FILES[newKey] = content;
  await saveFiles(MOCK_FILES);
  return `Successfully renamed ${oldFilename} to ${newFilename}`;
};

export const moveFile = async (sourcePath: string, targetPath: string): Promise<string> => {
  if (inObsidian) {
    // @ts-ignore
    const file = getObsidianApp().vault.getAbstractFileByPath(sourcePath);
    if (!file) throw new Error(`Source file not found: ${sourcePath}`);
    
    // @ts-ignore
    const targetFile = getObsidianApp().vault.getAbstractFileByPath(targetPath);
    if (targetFile) throw new Error(`Target file already exists: ${targetPath}`);
    
    // @ts-ignore
    await getObsidianApp().fileManager.renameFile(file, targetPath);
    return `Moved ${sourcePath} to ${targetPath} in vault`;
  }

  const sourceKey = sourcePath.toLowerCase();
  const targetKey = targetPath.toLowerCase();
  
  if (!MOCK_FILES[sourceKey]) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }
  if (MOCK_FILES[targetKey]) {
    throw new Error(`Target file already exists: ${targetPath}`);
  }
  
  const content = MOCK_FILES[sourceKey];
  delete MOCK_FILES[sourceKey];
  MOCK_FILES[targetKey] = content;
  await saveFiles(MOCK_FILES);
  return `Successfully moved ${sourcePath} to ${targetPath}`;
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
  if (inObsidian) {
    // @ts-ignore
    const folder = getObsidianApp().vault.getAbstractFileByPath(path);
    if (folder) {
      throw new Error(`Directory already exists: ${path}`);
    }
    // @ts-ignore
    await getObsidianApp().vault.createFolder(path);
    return `Created directory ${path} in vault`;
  }

  // For mock environment, check if any files exist in this directory path
  const normalizedPath = path.toLowerCase().replace(/\\/g, '/');
  const existingFiles = Object.keys(MOCK_FILES).filter(key => 
    key.startsWith(normalizedPath + '/')
  );
  
  if (existingFiles.length > 0) {
    throw new Error(`Directory already exists or contains files: ${path}`);
  }
  
  // In mock environment, directories are implicit, so we just return success
  return `Successfully created directory ${path}`;
};

export const deleteFile = async (filename: string): Promise<string> => {
  if (inObsidian) {
    // @ts-ignore
    const file = getObsidianApp().vault.getAbstractFileByPath(filename);
    if (!file) throw new Error(`File not found: ${filename}`);
    
    // Create trash folder if it doesn't exist
    const trashFolderPath = 'chat history/trash';
    // @ts-ignore
    const trashFolder = getObsidianApp().vault.getAbstractFileByPath(trashFolderPath);
    if (!trashFolder) {
      // @ts-ignore
      await getObsidianApp().vault.createFolder(trashFolderPath);
    }
    
    // Generate unique filename in trash to avoid conflicts
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = filename.split('/').pop() || filename;
    const trashFilename = `${trashFolderPath}/${timestamp}-${fileName}`;
    
    // Move file to trash instead of deleting
    // @ts-ignore
    await getObsidianApp().fileManager.renameFile(file, trashFilename);
    return `Moved ${filename} to trash`;
  }

  const key = filename.toLowerCase();
  
  if (!MOCK_FILES[key]) {
    throw new Error(`File not found: ${filename}`);
  }
  
  // In mock environment, simulate moving to trash by removing from main files
  // In a real implementation, we would move to a trash structure
  delete MOCK_FILES[key];
  await saveFiles(MOCK_FILES);
  return `Successfully moved ${filename} to trash`;
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
