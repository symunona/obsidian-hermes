import { getObsidianApp } from '../utils/environment';
import { MarkdownView } from 'obsidian';
import type { ToolCallbacks } from '../types';
import { getErrorMessage } from '../utils/getErrorMessage';

type ToolArgs = Record<string, unknown>;

export const declaration = {
  name: 'reveal_active_pane',
  description: 'Reveals and displays information about the last active text editor in Obsidian, including file path, view type, and editor state. Uses getActiveFile() and getLastOpenFiles() for accurate results.'
};

export const instruction = `- reveal_active_pane: Use this to get information about the last active text editor in Obsidian, including what file was most recently edited, the view type, and editor details. Uses getActiveFile() for accurate results.`;

export const execute = (_args: ToolArgs, callbacks: ToolCallbacks): Promise<unknown> => {
  const app = getObsidianApp();
  
  if (!app || !app.workspace) {
    callbacks.onSystem('Error: Not running in Obsidian or workspace unavailable', {
      name: 'reveal_active_pane',
      filename: 'Active Pane',
      error: 'Obsidian workspace not available'
    });
    return Promise.resolve({ error: 'Obsidian workspace not available' });
  }

  try {
    const workspace = app.workspace;
    
    // Get the most recently active file (better than activeLeaf for text editors)
    const activeFile = workspace.getActiveFile();
    const lastOpenFiles = workspace.getLastOpenFiles();
    
    // Try to get the active markdown view using the recommended API
    const activeMarkdownView = workspace.getActiveViewOfType(MarkdownView);
    let targetLeaf = activeMarkdownView?.leaf || null;
    const targetFile = activeFile;
    
    // If no active markdown view, try to find a leaf with the active file
    if (!targetLeaf && targetFile) {
      const leaves = workspace.getLeavesOfType('markdown');
      targetLeaf = leaves.find(leaf => (leaf.view as MarkdownView).file === targetFile) || leaves[0] || null;
    }
    
    if (!targetLeaf && !targetFile) {
      callbacks.onSystem('No active text editor found', {
        name: 'reveal_active_pane',
        filename: 'Active Editor',
        status: 'error',
        error: 'No active text editor currently available'
      });
      return Promise.resolve({ error: 'No active text editor currently available' });
    }

    // Prefer the direct view reference if available, otherwise get from leaf
    const view = activeMarkdownView || (targetLeaf?.view as MarkdownView | undefined);
    const state = view?.getState();
    const file = view?.file || targetFile;
    
    // Gather pane information using only officially typed Obsidian APIs
    const paneInfo = {
      viewType: view?.getViewType() || 'unknown',
      hasParent: !!targetLeaf?.parent,
      // File information if available
      filePath: file ? file.path : null,
      fileName: file ? file.name : null,
      fileExtension: file ? file.extension : null,
      fileSize: file ? file.stat?.size : null,
      fileModified: file ? file.stat?.mtime : null,
      // View state information
      viewState: state,
      mode: state?.mode || null,
      source: state?.source || null,
      // Additional view-specific info (MarkdownView has typed editor property)
      editorInfo: view?.editor ? {
        cursor: view.editor.getCursor(),
        selection: view.editor.getSelection(),
        lineCount: view.editor.lineCount(),
        isFocused: view.editor.hasFocus()
      } : null,
      // Additional context about recent files
      lastOpenFiles: lastOpenFiles,
      isActiveFile: !!activeFile,
      hasActiveLeaf: !!targetLeaf
    };

    callbacks.onSystem('Active pane information retrieved', {
      name: 'reveal_active_pane',
      filename: paneInfo.fileName || 'Active Pane',
      status: 'success',
      paneInfo
    });

    return Promise.resolve({ paneInfo });
    
  } catch (error) {
    console.error('Reveal active pane error:', error);
    callbacks.onSystem('Error retrieving active pane information', {
      name: 'reveal_active_pane',
      filename: 'Active Pane',
      status: 'error',
      error: getErrorMessage(error)
    });
    return Promise.resolve({ error: getErrorMessage(error) });
  }
};
