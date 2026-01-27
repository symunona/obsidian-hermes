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

    containerEl.createEl('h2', { text: 'Hermes Voice Assistant' });

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
      .setName('Custom Context')
      .setDesc('Define specific behaviors or rules for the assistant (added to every session)')
      .addTextArea((text) => {
        text
          .setPlaceholder('Define specific behaviors, personalities, or rules for the AI...')
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
    systemInstructionFragment.createSpan({ text: 'Core logic instructions for the AI assistant' });
    systemInstructionFragment.createEl('br');
    const resetLink = systemInstructionFragment.createEl('a', {
      text: 'Reset to default'
    });
    resetLink.style.color = 'rgb(239 68 68)';
    resetLink.style.cursor = 'pointer';
    resetLink.style.fontSize = '0.875rem';
    resetLink.style.transition = 'color 0.2s';
    resetLink.addEventListener('mouseenter', () => {
      resetLink.style.color = 'rgb(220 38 38)';
    });
    resetLink.addEventListener('mouseleave', () => {
      resetLink.style.color = 'rgb(239 68 68)';
    });
    resetLink.addEventListener('click', async () => {
      if (this.plugin.settings) {
        this.plugin.settings.systemInstruction = DEFAULT_SYSTEM_INSTRUCTION;
        await this.plugin.saveSettings();
        // Refresh the settings display to show the updated value
        this.display();
      }
    });

    new Setting(containerEl)
      .setName('System Instructions')
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
      .setName('Chat History Folder')
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
    containerEl.createEl('h3', { text: 'API Authentication' });

    new Setting(containerEl)
      .setName('Gemini API Key')
      .setDesc('Enter your Gemini API key for the voice assistant')
      .addText((text) => {
        text
          .setPlaceholder('Enter your Gemini API Key...')
          .setValue(this.plugin.settings?.manualApiKey || '')
          .onChange(async (value) => {
            if (this.plugin.settings) {
              this.plugin.settings.manualApiKey = value;
              await this.plugin.saveSettings();
            }
          });
        text.inputEl.type = 'password';
      });

    // Serper API Key for image search
    const serperFragment = document.createDocumentFragment();
    serperFragment.createSpan({ text: 'API key for image search. Get 2,500 free credits at ' });
    const serperLink = serperFragment.createEl('a', {
      href: 'https://serper.dev/',
      text: 'serper.dev',
    });
    serperLink.setAttr('target', '_blank');

    new Setting(containerEl)
      .setName('Serper API Key')
      .setDesc(serperFragment)
      .addText((text) => {
        text
          .setPlaceholder('Enter your Serper API Key...')
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
    const docText = docFragment.createSpan({ text: 'API keys are handled via manual entry. ' });
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
