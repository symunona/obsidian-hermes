
import { ItemView, WorkspaceLeaf } from 'obsidian';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

export const VIEW_TYPE_HERMES = "hermes-voice-view";

export class HermesView extends ItemView {
    root: ReactDOM.Root | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE_HERMES;
    }

    getDisplayText() {
        return "Hermes Voice Assistant";
    }

    getIcon() {
        return "microphone";
    }

    async onOpen() {
        // Use any cast to bypass containerEl property error and use any for the augmented empty() method on HTMLElement
        const container = (this as any).containerEl.children[1] as HTMLElement;
        if (container) {
            (container as any).empty();
        }
        
        // Ensure the container has the correct styling for the React app
        container.style.padding = '0';
        container.style.overflow = 'hidden';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';

        this.root = ReactDOM.createRoot(container);
        this.root.render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
    }

    async onClose() {
        this.root?.unmount();
    }
}
