
import { Type } from '@google/genai';
import { readFile } from '../services/mockFiles';
import { getDirectoryFromPath, openFileInObsidian } from '../utils/environment';

export const declaration = {
  name: 'read_file',
  description: 'Read the full content of a specified file using path relative to vault root.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING, description: 'Path relative to vault root (e.g., "projects/notes.md" or "notes.md" for root level)' },
      newWindow: { type: Type.BOOLEAN, description: 'Open in a new window/tab (default: false, reuses existing window)' },
      split: { type: Type.BOOLEAN, description: 'Open in a split view (default: false)' }
    },
    required: ['filename']
  }
};

export const instruction = `- read_file: Use this to ingest the contents of a note. All paths are relative to vault root (e.g., "projects/notes.md" or "notes.md" for root level). You should read a file before proposing major edits to ensure context. Parameters:
  - filename: required, path to the file
  - newWindow: optional, default false, opens in new window/tab when true
  - split: optional, default false, opens in split view when true`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const { filename, newWindow = false, split = false } = args;
  const readContent = await readFile(filename);
  
  // Handle file opening in Obsidian if applicable
  await openFileInObsidian(filename, { newWindow, split });
  
  callbacks.onSystem(`Opened ${filename}`, {
    name: 'read_file',
    filename: filename,
    oldContent: readContent,
    newContent: readContent,
    additions: 0,
    removals: 0,
    newWindow,
    split
  });
  const fileDirectory = getDirectoryFromPath(filename);
  callbacks.onFileState(fileDirectory, filename);
  return { content: readContent };
};
