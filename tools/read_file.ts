
import { Type } from '@google/genai';
import { readFile } from '../services/mockFiles';

export const declaration = {
  name: 'read_file',
  description: 'Read the full content of a specified file.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING, description: 'The name of the file to read' }
    },
    required: ['filename']
  }
};

export const instruction = `- read_file: Use this to ingest the contents of a note. You should read a file before proposing major edits to ensure context.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const readContent = await readFile(args.filename);
  callbacks.onSystem(`Opened ${args.filename}`, {
    name: 'read_file',
    filename: args.filename,
    oldContent: readContent,
    newContent: readContent,
    additions: 0,
    removals: 0
  });
  callbacks.onFileState('/', args.filename);
  return { content: readContent };
};
