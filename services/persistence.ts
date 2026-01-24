
const FILES_KEY = 'hermes_os_filesystem';
const SETTINGS_KEY = 'hermes_os_settings';

export const saveFiles = async (files: Record<string, string>): Promise<void> => {
  localStorage.setItem(FILES_KEY, JSON.stringify(files));
};

export const loadFiles = async (): Promise<Record<string, string> | null> => {
  const data = localStorage.getItem(FILES_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse persistent storage', e);
    return null;
  }
};

export const saveAppSettings = (settings: any) => {
  try {
    // Only save serializable parts of the state
    const toSave = { ...settings };
    // Prevent accidental persistence of large volatile logs if they were part of the state
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
};

export const loadAppSettings = (): any | null => {
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load settings', e);
    return null;
  }
};
