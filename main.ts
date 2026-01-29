
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { HermesMainViewObsidian, VIEW_TYPE_HERMES } from './HermesMainViewObsidian';
import { setObsidianPlugin, loadAppSettingsAsync, saveAppSettings } from './persistence/persistence';
import { HermesSettingsTab, HermesSettings, DEFAULT_HERMES_SETTINGS } from './obsidian/HermesSettingsTab';
import { DEFAULT_SYSTEM_INSTRUCTION } from './utils/defaultPrompt';

export default class HermesPlugin extends Plugin {
    settings: HermesSettings = DEFAULT_HERMES_SETTINGS;

    async onload() {
        // Register plugin instance for persistence
        setObsidianPlugin(this);
        
        // Pre-load settings from data.json
        await this.loadSettings();
        const loadedSettings = await loadAppSettingsAsync();
        
        // Sync plugin settings with persistence layer
        if (loadedSettings) {
            this.settings = { ...this.settings, ...loadedSettings };
            // If systemInstruction is empty, populate it with the default prompt
            if (!this.settings.systemInstruction || this.settings.systemInstruction.trim() === '') {
                this.settings.systemInstruction = DEFAULT_SYSTEM_INSTRUCTION;
            }
            await this.saveSettings();
        } else {
            // First load with no existing settings - populate with default prompt
            this.settings.systemInstruction = DEFAULT_SYSTEM_INSTRUCTION;
            await this.saveSettings();
        }
        
        // Register settings tab
        this.addSettingTab(new HermesSettingsTab(this.app, this));
        
        // Cast this to any to bypass errors where Obsidian Plugin methods are not recognized by the compiler
        this.registerView(
            VIEW_TYPE_HERMES,
            (leaf: WorkspaceLeaf) => new HermesMainViewObsidian(leaf)
        );

        // Add a ribbon icon to open the assistant
        this.addRibbonIcon('mic-vocal', 'Hermes voice assistant', async () => {
            await this.activateView();
        });

        // Add a command to the command palette
        this.addCommand({
            id: 'open-hermes-voice',
            name: 'Open hermes assistant',
            callback: async () => {
                await this.activateView();
            }
        });

        // Add command to start conversation
        this.addCommand({
            id: 'start-hermes-conversation',
            name: 'Start hermes conversation',
            callback: async () => {
                await this.startConversation();
            }
        });

        // Add command to stop conversation
        this.addCommand({
            id: 'stop-hermes-conversation',
            name: 'Stop hermes conversation',
            callback: () => {
                this.stopConversation();
            }
        });

        // Add command to toggle conversation state
        this.addCommand({
            id: 'toggle-hermes-conversation',
            name: 'Toggle hermes conversation',
            callback: async () => {
                await this.toggleConversation();
            }
        });
    }

    async activateView() {
        // Cast this to any to access the app property which is not being recognized on the Plugin instance
        const { workspace } = this.app;

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
            await workspace.revealLeaf(leaf);
        }
    }

    async startConversation() {
        // First activate the view if it's not already active
        await this.activateView();
        
        // Get the active leaf and trigger start session
        const { workspace } = this.app;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HERMES);
        
        if (leaves.length > 0) {
            const leaf = leaves[0];
            const view = leaf.view as HermesMainViewObsidian;
            
            // Access the React component's startSession function
            if (view.startSession) {
                view.startSession();
            } else {
                // Try to trigger the start session through DOM events
                const startButton = view.containerEl.querySelector('[data-action="start-session"]');
                if (startButton instanceof HTMLElement) {
                    startButton.click();
                }
            }
        }
    }

    stopConversation() {
        // Get the active leaf and trigger stop session
        const { workspace } = this.app;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HERMES);
        
        if (leaves.length > 0) {
            const leaf = leaves[0];
            const view = leaf.view as HermesMainViewObsidian;
            
            // Access the React component's stopSession function
            if (view.stopSession) {
                view.stopSession();
            } else {
                // Try to trigger the stop session through DOM events
                const stopButton = view.containerEl.querySelector('[data-action="stop-session"]');
                if (stopButton instanceof HTMLElement) {
                    stopButton.click();
                }
            }
        }
    }

    async toggleConversation() {
        // Get the active leaf to check current state
        const { workspace } = this.app;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HERMES);
        
        if (leaves.length > 0) {
            const leaf = leaves[0];
            const view = leaf.view as HermesMainViewObsidian;
            
            // Access the React component's toggleSession function
            if (view.toggleSession) {
                view.toggleSession();
            } else {
                // Fallback: check if currently listening by looking for the stop button
                const stopButton = view.containerEl.querySelector('[data-action="stop-session"]');
                
                if (stopButton instanceof HTMLElement) {
                    // If stop button exists, conversation is active, so stop it
                    this.stopConversation();
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
        this.settings = Object.assign({}, DEFAULT_HERMES_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        // Use only the persistence layer to avoid race conditions
        await saveAppSettings(this.settings);
        
        // Notify React app about settings change
        if (typeof window !== 'undefined' && window.hermesSettingsUpdate) {
            window.hermesSettingsUpdate(this.settings);
        }
    }
}
