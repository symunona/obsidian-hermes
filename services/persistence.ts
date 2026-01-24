
const FILES_KEY = 'haiku_os_filesystem';
const SETTINGS_KEY = 'haiku_os_settings';

export const saveFiles = async (files: Record<string, string>): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      localStorage.setItem(FILES_KEY, JSON.stringify(files));
      resolve();
    }, 50);
  });
};

export const loadFiles = async (): Promise<Record<string, string> | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const data = localStorage.getItem(FILES_KEY);
      if (!data) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        console.error('Failed to parse persistent storage', e);
        resolve(null);
      }
    }, 50);
  });
};

export const saveAppSettings = (settings: any) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const loadAppSettings = (): any | null => {
  const data = localStorage.getItem(SETTINGS_KEY);
  return data ? JSON.parse(data) : null;
};
