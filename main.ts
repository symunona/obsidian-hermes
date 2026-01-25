
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { HermesMainViewObsidian, VIEW_TYPE_HERMES } from './HermesMainViewObsidian';
import { setObsidianPlugin, loadAppSettingsAsync } from './persistence/persistence';
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
        (this as any).addRibbonIcon('microphone', 'Hermes Voice Assistant', () => {
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

    onunload() {
        // Clean up when plugin is disabled
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_HERMES_SETTINGS, await (this as any).loadData());
    }

    async saveSettings() {
        await (this as any).saveData(this.settings);
    }
}
