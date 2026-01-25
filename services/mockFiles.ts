
import { loadFiles, saveFiles } from './persistence';
import { SearchResult, SearchMatch } from '../types';

// Check if we are running inside Obsidian
// @ts-ignore
const isObsidian = typeof app !== 'undefined' && app.vault !== undefined;

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
  if (isObsidian) {
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
  if (isObsidian) {
    // @ts-ignore
    return app.vault.getMarkdownFiles().map(f => f.path);
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

  if (isObsidian) {
    // @ts-ignore
    allFiles = app.vault.getMarkdownFiles().map(f => ({
      path: f.path,
      name: f.name,
      mtime: f.stat.mtime,
      size: f.stat.size
    }));
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
  if (isObsidian) {
    // @ts-ignore
    const allFiles = app.vault.getAllLoadedFiles();
    // @ts-ignore
    return allFiles.filter(f => f.children).map(f => f.path).sort();
  } else {
    const paths = Object.keys(MOCK_FILES);
    const folders = new Set<string>(['/']);
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

export const readFile = async (filename: string): Promise<string> => {
  if (isObsidian) {
    // @ts-ignore
    const file = app.vault.getAbstractFileByPath(filename);
    if (!file) throw new Error(`File not found in vault: ${filename}`);
    // @ts-ignore
    return await app.vault.read(file);
  }

  const content = MOCK_FILES[filename.toLowerCase()];
  if (!content) {
    throw new Error(`File not found: ${filename}`);
  }
  return content;
};

export const createFile = async (filename: string, content: string): Promise<string> => {
  if (isObsidian) {
    // @ts-ignore
    await app.vault.create(filename, content);
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
  if (isObsidian) {
    // @ts-ignore
    const file = app.vault.getAbstractFileByPath(filename);
    if (!file) throw new Error(`File not found: ${filename}`);
    // @ts-ignore
    await app.vault.modify(file, content);
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
  if (isObsidian) {
    // @ts-ignore
    const file = app.vault.getAbstractFileByPath(oldFilename);
    if (!file) throw new Error(`File not found: ${oldFilename}`);
    // @ts-ignore
    await app.fileManager.renameFile(file, newFilename);
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
