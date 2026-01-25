export interface AppSettings {
  apiKey?: string;
  systemInstruction?: string;
  voiceSettings?: {
    rate: number;
    pitch: number;
    volume: number;
  };
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem('hermes-settings', JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save settings:', error);
  }
}

export function loadAppSettings(): AppSettings | null {
  try {
    const stored = localStorage.getItem('hermes-settings');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to load settings:', error);
    return null;
  }
}

// Mock file persistence for standalone mode
export function loadFiles(): Record<string, string> {
  try {
    const stored = localStorage.getItem('hermes-files');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load files:', error);
    return {};
  }
}

export function saveFiles(files: Record<string, string>): void {
  try {
    localStorage.setItem('hermes-files', JSON.stringify(files));
  } catch (error) {
    console.warn('Failed to save files:', error);
  }
}

export function isObsidianMode(): boolean {
  // Check if we're running in Obsidian environment
  try {
    return typeof (window as any).require !== 'undefined' && 
           (window as any).require('obsidian');
  } catch {
    return false;
  }
}
