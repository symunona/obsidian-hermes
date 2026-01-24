
import { loadFiles, saveFiles } from './persistence';

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
World is white and still.`
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

export const searchFiles = async (pattern: string, isRegexp: boolean, flags: string = 'i') => {
  const fileList = listDirectory();
  const results = [];
  const regex = isRegexp ? new RegExp(pattern, flags) : null;

  for (const filename of fileList) {
    const content = await readFile(filename);
    const lines = content.split('\n');
    const matches = [];

    lines.forEach((line, index) => {
      let isMatch = false;
      if (regex) {
        isMatch = regex.test(line);
      } else {
        isMatch = line.toLowerCase().includes(pattern.toLowerCase());
      }

      if (isMatch) {
        matches.push({ line: index + 1, content: line.trim() });
      }
    });

    if (matches.length > 0) {
      results.push({ filename, matches });
    }
  }
  return results;
};

export const editFile = async (filename: string, operation: 'append' | 'replace_line' | 'remove_line', text?: string, lineNumber?: number): Promise<string> => {
  let content = "";
  if (isObsidian) {
    content = await readFile(filename);
  } else {
    const key = filename.toLowerCase();
    content = MOCK_FILES[key];
    if (!content) throw new Error(`File not found: ${filename}`);
  }
  
  let lines = content.split('\n');
  
  switch (operation) {
    case 'append':
      if (text) lines.push(text);
      break;
    case 'replace_line':
      if (typeof lineNumber === 'number' && text) {
        if (lineNumber < 1 || lineNumber > lines.length) throw new Error('Line number out of range');
        lines[lineNumber - 1] = text;
      }
      break;
    case 'remove_line':
      if (typeof lineNumber === 'number') {
        if (lineNumber < 1 || lineNumber > lines.length) throw new Error('Line number out of range');
        lines.splice(lineNumber - 1, 1);
      }
      break;
  }
  
  const newContent = lines.join('\n');
  await updateFile(filename, newContent);
  return `Successfully performed ${operation} on ${filename}`;
};
