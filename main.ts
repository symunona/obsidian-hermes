
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { HermesMainViewObsidian, VIEW_TYPE_HERMES } from './HermesMainViewObsidian';
import { setObsidianPlugin, loadAppSettingsAsync, reloadAppSettings } from './persistence/persistence';
import { HermesSettingsTab, HermesSettings, DEFAULT_HERMES_SETTINGS } from './obsidian/HermesSettingsTab';

export default class HermesPlugin extends Plugin {
    settings: HermesSettings = DEFAULT_HERMES_SETTINGS;

    async onload() {
        // Register plugin instance for persistence
        setObsidianPlugin(this);
        
        // Pre-load settings from data.json
        await this.loadSettings();
        await loadAppSettingsAsync();
        
        // Register settings tab
        (this as any).addSettingTab(new HermesSettingsTab((this as any).app, this));
        
        // Cast this to any to bypass errors where Obsidian Plugin methods are not recognized by the compiler
        (this as any).registerView(
            VIEW_TYPE_HERMES,
            (leaf: WorkspaceLeaf) => new HermesMainViewObsidian(leaf)
        );

        // Add a ribbon icon to open the assistant
        (this as any).addRibbonIcon('mic-vocal', 'Hermes Voice Assistant', () => {
            this.activateView();
        });

        // Add a command to the command palette
        (this as any).addCommand({
            id: 'open-hermes-voice',
            name: 'Open Hermes Assistant',
            callback: () => {
                this.activateView();
            }
        });

        // Add command to start conversation
        (this as any).addCommand({
            id: 'start-hermes-conversation',
            name: 'Start Hermes Conversation',
            callback: () => {
                this.startConversation();
            }
        });

        // Add command to stop conversation
        (this as any).addCommand({
            id: 'stop-hermes-conversation',
            name: 'Stop Hermes Conversation',
            callback: () => {
                this.stopConversation();
            }
        });

        // Add command to toggle conversation state
        (this as any).addCommand({
            id: 'toggle-hermes-conversation',
            name: 'Toggle Hermes Conversation',
            hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'l' }],
            callback: () => {
                this.toggleConversation();
            }
        });
    }

    async activateView() {
        // Cast this to any to access the app property which is not being recognized on the Plugin instance
        const { workspace } = (this as any).app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HERMES);

        if (leaves.length > 0) {
            // If the view already exists, focus it
            leaf = leaves[0];
        } else {
            // Otherwise, create a new leaf in the right sidebar
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: VIEW_TYPE_HERMES, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    async startConversation() {
        // First activate the view if it's not already active
        await this.activateView();
        
        // Get the active leaf and trigger start session
        const { workspace } = (this as any).app;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HERMES);
        
        if (leaves.length > 0) {
            const leaf = leaves[0];
            const view = leaf.view as any;
            
            // Access the React component's startSession function
            if (view.startSession) {
                view.startSession();
            } else {
                // Try to trigger the start session through DOM events
                const startButton = view.containerEl.querySelector('[data-action="start-session"]');
                if (startButton) {
                    (startButton as HTMLElement).click();
                }
            }
        }
    }

    async stopConversation() {
        // Get the active leaf and trigger stop session
        const { workspace } = (this as any).app;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HERMES);
        
        if (leaves.length > 0) {
            const leaf = leaves[0];
            const view = leaf.view as any;
            
            // Access the React component's stopSession function
            if (view.stopSession) {
                view.stopSession();
            } else {
                // Try to trigger the stop session through DOM events
                const stopButton = view.containerEl.querySelector('[data-action="stop-session"]');
                if (stopButton) {
                    (stopButton as HTMLElement).click();
                }
            }
        }
    }

    async toggleConversation() {
        // Get the active leaf to check current state
        const { workspace } = (this as any).app;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HERMES);
        
        if (leaves.length > 0) {
            const leaf = leaves[0];
            const view = leaf.view as any;
            
            // Access the React component's toggleSession function
            if (view.toggleSession) {
                view.toggleSession();
            } else {
                // Fallback: check if currently listening by looking for the stop button
                const stopButton = view.containerEl.querySelector('[data-action="stop-session"]');
                
                if (stopButton) {
                    // If stop button exists, conversation is active, so stop it
                    await this.stopConversation();
                } else {
                    // If no stop button, conversation is not active, so start it
                    await this.startConversation();
                }
            }
        }
    }

    onunload() {
        // Clean up when plugin is disabled
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_HERMES_SETTINGS, await (this as any).loadData());
    }

    async saveSettings() {
        await (this as any).saveData(this.settings);
        
        // Notify React app about settings change
        if (typeof window !== 'undefined' && (window as any).hermesSettingsUpdate) {
            (window as any).hermesSettingsUpdate(this.settings);
        }
    }
}
