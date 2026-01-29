import React from 'react';
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { createRoot } from 'react-dom/client';
import App, { AppHandle } from './App';
import './styles.css';

export const VIEW_TYPE_HERMES = 'hermes-voice-assistant';

export class HermesMainViewObsidian extends ItemView {
  private root: ReturnType<typeof createRoot> = null!;
  private appRef: React.RefObject<AppHandle> = React.createRef();

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_HERMES;
  }

  getDisplayText(): string {
    return 'Hermes voice assistant';
  }

  getIcon(): string {
    return 'mic-vocal';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    const mount = container.createDiv({ cls: 'hermes-root obsidian' });
    this.root = createRoot(mount);
    await this.root.render(
      <React.StrictMode>
        <App ref={this.appRef} />
      </React.StrictMode>
    );
  }

  async onClose(): Promise<void> {
    if (this.root) {
      await this.root.unmount();
      this.root = null;
    }
  }

  // Expose start session method for command palette
  startSession(): void {
    if (this.appRef.current && this.appRef.current.startSession) {
      void this.appRef.current.startSession();
    }
  }

  // Expose stop session method for command palette
  stopSession(): void {
    if (this.appRef.current && this.appRef.current.stopSession) {
      void this.appRef.current.stopSession();
    }
  }

  // Expose toggle session method for command palette
  toggleSession(): void {
    if (this.appRef.current && this.appRef.current.toggleSession) {
      void this.appRef.current.toggleSession();
    }
  }
}
