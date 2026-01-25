import type { Plugin } from 'obsidian';

let obsidianPlugin: Plugin | null = null;
let cachedSettings: any = null;

export const setObsidianPlugin = (plugin: Plugin) => {
  obsidianPlugin = plugin;
};

export const getObsidianPlugin = (): Plugin | null => obsidianPlugin;

export const saveFiles = async (files: Record<string, string>): Promise<void> => {
  // For Obsidian, we could use the vault API in the future
  // For now, this is a placeholder that does nothing since files are managed by Obsidian
  console.warn('saveFiles called in Obsidian mode - files are managed by Obsidian vault');
};

export const loadFiles = async (): Promise<Record<string, string> | null> => {
  // For Obsidian, files are managed by the vault
  // Return null to indicate no local file storage
  return null;
};

export const saveAppSettings = async (settings: any): Promise<void> => {
  try {
    const toSave = { ...settings };
    cachedSettings = toSave;
    
    if (obsidianPlugin) {
      await (obsidianPlugin as any).saveData(toSave);
    }
  } catch (e) {
    console.error('Failed to save settings', e);
  }
};

export const loadAppSettings = (): any | null => {
  if (cachedSettings) return cachedSettings;
  return null;
};

export const loadAppSettingsAsync = async (): Promise<any | null> => {
  if (cachedSettings) return cachedSettings;
  
  if (obsidianPlugin) {
    try {
      const data = await (obsidianPlugin as any).loadData();
      cachedSettings = data || {};
      return cachedSettings;
    } catch (e) {
      console.error('Failed to load settings from Obsidian', e);
      return null;
    }
  }
  
  return null;
};
