
import { Type } from '@google/genai';
import { createFile } from '../services/mockFiles';

export const declaration = {
  name: 'create_file',
  description: 'Create a new file with initial content.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filename: { type: Type.STRING },
      content: { type: Type.STRING }
    },
    required: ['filename', 'content']
  }
};

export const instruction = `- create_file: Use this to initialize new notes in the vault. Always provide meaningful initial content.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  await createFile(args.filename, args.content);
  callbacks.onSystem(`Created ${args.filename}`, {
    name: 'create_file',
    filename: args.filename,
    oldContent: '',
    newContent: args.content,
    additions: args.content.split('\n').length,
    removals: 0
  });
  callbacks.onFileState('/', args.filename);
  return { status: 'created' };
};
