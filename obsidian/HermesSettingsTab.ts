import { App, PluginSettingTab, Setting } from 'obsidian';
import type HermesPlugin from '../main';
import { DEFAULT_SYSTEM_INSTRUCTION } from '../utils/defaultPrompt';

const AVAILABLE_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

export interface HermesSettings {
  voiceName: string;
  customContext: string;
  systemInstruction: string;
  manualApiKey: string;
  serperApiKey: string;
  chatHistoryFolder: string;
}

export const DEFAULT_HERMES_SETTINGS: HermesSettings = {
  voiceName: 'Zephyr',
  customContext: '',
  systemInstruction: '',
  manualApiKey: '',
  serperApiKey: '',
  chatHistoryFolder: 'chat-history',
};

export class HermesSettingsTab extends PluginSettingTab {
  plugin: HermesPlugin;

  constructor(app: App, plugin: HermesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.classList.add('hermes-settings');

    ;

    // Voice Selection
    new Setting(containerEl)
      .setName('Voice')
      .setDesc('Select the voice persona for the assistant')
      .addDropdown((dropdown) => {
        AVAILABLE_VOICES.forEach((voice) => {
          dropdown.addOption(voice, voice);
        });
        dropdown
          .setValue(this.plugin.settings?.voiceName || DEFAULT_HERMES_SETTINGS.voiceName)
          .onChange(async (value) => {
            if (this.plugin.settings) {
              this.plugin.settings.voiceName = value;
              await this.plugin.saveSettings();
            }
          });
      });

    // Custom Context
    new Setting(containerEl)
      .setName('Custom context')
      .setDesc('Define specific behaviors or rules for the assistant (added to every session)')
      .addTextArea((text) => {
        text
          .setPlaceholder('Define specific behaviors, personalities, or rules for the ai...')
          .setValue(this.plugin.settings?.customContext || '')
          .onChange(async (value) => {
            if (this.plugin.settings) {
              this.plugin.settings.customContext = value;
              await this.plugin.saveSettings();
            }
          });
        text.inputEl.rows = 4;
        text.inputEl.cols = 50;
      });

    // System Instructions
    const systemInstructionFragment = document.createDocumentFragment();
    systemInstructionFragment.createSpan({ text: 'Core logic instructions for the ai assistant' });
    systemInstructionFragment.createEl('br');
    const resetLink = systemInstructionFragment.createEl('a', {
      text: 'Reset to default'
    });
    resetLink.addClass('hermes-reset-link');
    resetLink.addEventListener('click', () => {
      if (this.plugin.settings) {
        this.plugin.settings.systemInstruction = DEFAULT_SYSTEM_INSTRUCTION;
        void this.plugin.saveSettings().then(() => {
          // Refresh the settings display to show the updated value
          this.display();
        });
      }
    });

    new Setting(containerEl)
      .setName('System instructions')
      .setDesc(systemInstructionFragment)
      .addTextArea((text) => {
        text
          .setPlaceholder('Core logic instructions...')
          .setValue(this.plugin.settings?.systemInstruction || '')
          .onChange(async (value) => {
            if (this.plugin.settings) {
              this.plugin.settings.systemInstruction = value;
              await this.plugin.saveSettings();
            }
          });
        text.inputEl.rows = 6;
        text.inputEl.cols = 50;
      });

    // Chat History Folder
    new Setting(containerEl)
      .setName('Chat history folder')
      .setDesc('Folder path where chat history will be saved')
      .addText((text) => {
        text
          .setPlaceholder('chat-history')
          .setValue(this.plugin.settings?.chatHistoryFolder || DEFAULT_HERMES_SETTINGS.chatHistoryFolder)
          .onChange(async (value) => {
            if (this.plugin.settings) {
              this.plugin.settings.chatHistoryFolder = value;
              await this.plugin.saveSettings();
            }
          });
      });

    // API Key Section
    new Setting(containerEl)
      .setName('Api authentication')
      .setHeading();

    new Setting(containerEl)
      .setName('Gemini api key')
      .setDesc('Enter your gemini api key for the voice assistant')
      .addText((text) => {
        text
          .setPlaceholder('Enter your gemini api key...')
          .setValue(this.plugin.settings?.manualApiKey || '')
          .onChange(async (value) => {
            if (this.plugin.settings) {
              this.plugin.settings.manualApiKey = value;
              await this.plugin.saveSettings();
            }
          });
        text.inputEl.type = 'password';
      });

    // Serper API key for image search
    const serperFragment = document.createDocumentFragment();
    serperFragment.createSpan({ text: 'Api key for image search. Get 2,500 free credits at ' });
    const serperLink = serperFragment.createEl('a', {
      href: 'https://serper.dev/',
      text: 'serper.dev',
    });
    serperLink.setAttr('target', '_blank');

    new Setting(containerEl)
      .setName('Serper api key')
      .setDesc(serperFragment)
      .addText((text) => {
        text
          .setPlaceholder('Enter your serper api key...')
          .setValue(this.plugin.settings?.serperApiKey || '')
          .onChange(async (value) => {
            if (this.plugin.settings) {
              this.plugin.settings.serperApiKey = value;
              await this.plugin.saveSettings();
            }
          });
        text.inputEl.type = 'password';
      });

    // Documentation link
    const docFragment = document.createDocumentFragment();
    const docText = docFragment.createSpan({ text: 'Api keys are handled via manual entry. ' });
    const docLink = docFragment.createEl('a', {
      href: 'https://ai.google.dev/gemini-api/docs/billing',
      text: 'Learn more about billing.',
    });
    docLink.setAttr('target', '_blank');
    docText.append(docLink);

    new Setting(containerEl)
      .setDesc(docFragment);
  }
}
