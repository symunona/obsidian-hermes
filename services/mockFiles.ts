
import { loadFiles, saveFiles } from './persistence';

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
  const persisted = await loadFiles();
  if (persisted) {
    MOCK_FILES = persisted;
  } else {
    await saveFiles(DEFAULT_FILES);
  }
  initialized = true;
};

export const listDirectory = (): string[] => {
  return Object.keys(MOCK_FILES);
};

export const readFile = (filename: string): string => {
  const content = MOCK_FILES[filename.toLowerCase()];
  if (!content) {
    throw new Error(`File not found: ${filename}`);
  }
  return content;
};

export const createFile = async (filename: string, content: string): Promise<string> => {
  const key = filename.toLowerCase();
  if (MOCK_FILES[key]) {
    throw new Error(`File already exists: ${filename}`);
  }
  MOCK_FILES[key] = content;
  await saveFiles(MOCK_FILES);
  return `Successfully created ${filename}`;
};

export const updateFile = async (filename: string, content: string): Promise<string> => {
  const key = filename.toLowerCase();
  if (!MOCK_FILES[key]) {
    throw new Error(`File not found: ${filename}`);
  }
  MOCK_FILES[key] = content;
  await saveFiles(MOCK_FILES);
  return `Successfully updated ${filename}`;
};

export const editFile = async (filename: string, operation: 'append' | 'replace_line' | 'remove_line', text?: string, lineNumber?: number): Promise<string> => {
  const key = filename.toLowerCase();
  if (!MOCK_FILES[key]) {
    throw new Error(`File not found: ${filename}`);
  }
  
  let lines = MOCK_FILES[key].split('\n');
  
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
  
  MOCK_FILES[key] = lines.join('\n');
  await saveFiles(MOCK_FILES);
  return `Successfully performed ${operation} on ${filename}`;
};
