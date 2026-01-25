
import { Type } from '@google/genai';
import { listDirectory, readFile, updateFile } from '../services/mockFiles';
import { openFileInObsidian } from '../utils/environment';

export const declaration = {
  name: 'search_and_replace_regex_global',
  description: 'Search and replace text across ALL files using regex.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      pattern: { type: Type.STRING },
      replacement: { type: Type.STRING },
      flags: { type: Type.STRING, description: 'Optional regex flags (default: "g")' }
    },
    required: ['pattern', 'replacement']
  }
};

export const instruction = `
GLOBAL SEARCH & REPLACE WORKFLOW:
1. When asked for a global replacement, ALWAYS run "search_regexp" first.
2. Report the number of files that will be updated.
3. ASK for explicit confirmation before calling "search_and_replace_regex_global".
4. After execution, report "updated all occurrences".`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const allFiles = listDirectory();
  const globalRe = new RegExp(args.pattern, args.flags || 'g');
  const multiDiffs = [];
  let totalFilesUpdated = 0;
  const updatedFilePaths: string[] = [];

  for (const file of allFiles) {
    const content = await readFile(file);
    if (globalRe.test(content)) {
      const updated = content.replace(globalRe, args.replacement);
      await updateFile(file, updated);
      multiDiffs.push({
        filename: file,
        oldContent: content,
        newContent: updated,
        additions: 1,
        removals: 1
      });
      updatedFilePaths.push(file);
      totalFilesUpdated++;
    }
  }
  
  callbacks.onSystem(`Global replace complete: ${totalFilesUpdated} files updated`, {
    name: 'search_and_replace_regex_global',
    filename: 'Vault Wide',
    multiDiffs
  });

  // Open the first modified file in Obsidian (focuses if already open)
  if (updatedFilePaths.length > 0) {
    await openFileInObsidian(updatedFilePaths[0]);
    callbacks.onFileState('/', updatedFilePaths);
  }

  return { status: 'success', filesUpdated: totalFilesUpdated };
};
