import React from 'react';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import App from './App';

export const VIEW_TYPE_HERMES = 'hermes-voice-assistant';

export class HermesView extends ItemView {
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_HERMES;
  }

  getDisplayText(): string {
    return 'Hermes Voice Assistant';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    const mount = container.createDiv({ cls: 'hermes-root' });
    this.root = createRoot(mount);
    this.root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }

  async onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}