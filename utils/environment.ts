/**
 * Environment detection utilities
 * Helps determine if the code is running in Obsidian vs standalone mode
 */

/**
 * Detects if the code is running inside Obsidian
 * @returns true if running in Obsidian, false if standalone
 */
export function isObsidian(): boolean {
  // Check if we're in Obsidian environment
  // @ts-ignore - Obsidian global app
  return typeof (globalThis as any).app !== 'undefined' && (globalThis as any).app?.vault !== undefined;
}

/**
 * Gets the Obsidian app instance if available
 * @returns Obsidian app instance or null
 */
export function getObsidianApp(): any {
  if (isObsidian()) {
    // @ts-ignore - Obsidian global app
    return (globalThis as any).app;
  }
  return null;
}

/**
 * Checks if Obsidian API is available
 * @returns true if Obsidian API methods are available
 */
export function hasObsidianAPI(): boolean {
  const app = getObsidianApp();
  return app && typeof app.vault !== 'undefined' && typeof app.workspace !== 'undefined';
}

/**
 * Gets the current vault if in Obsidian
 * @returns Obsidian vault or null
 */
export function getVault(): any {
  const app = getObsidianApp();
  return app?.vault || null;
}

/**
 * Gets the current workspace if in Obsidian
 * @returns Obsidian workspace or null
 */
export function getWorkspace(): any {
  const app = getObsidianApp();
  return app?.workspace || null;
}

/**
 * Environment type enum
 */
export enum Environment {
  OBSIDIAN = 'obsidian',
  STANDALONE = 'standalone'
}

/**
 * Gets the current environment type
 * @returns Environment enum value
 */
export function getEnvironment(): Environment {
  return isObsidian() ? Environment.OBSIDIAN : Environment.STANDALONE;
}

/**
 * Options for opening a file in Obsidian
 */
export interface OpenFileOptions {
  newWindow?: boolean;  // Open in a new tab/window (default: false)
  split?: boolean;      // Open in a split view (default: false)
}

/**
 * Opens a file in Obsidian, reusing an existing leaf if the file is already open
 * @param filename - Path to the file relative to vault root
 * @param options - Options for how to open the file
 * @returns true if file was opened successfully, false otherwise
 */
export async function openFileInObsidian(filename: string, options: OpenFileOptions = {}): Promise<boolean> {
  if (!isObsidian()) {
    return false;
  }

  try {
    const app = getObsidianApp();
    const file = app.vault.getAbstractFileByPath(filename);
    
    if (!file) {
      console.warn(`File not found: ${filename}`);
      return false;
    }

    const { newWindow = false, split = false } = options;
    const workspace = app.workspace;

    // First, check if the file is already open in any leaf
    if (!newWindow && !split) {
      const existingLeaf = workspace.getLeavesOfType('markdown').find(
        (leaf: any) => leaf.view?.file?.path === filename
      );
      
      if (existingLeaf) {
        // File is already open, just focus on it
        workspace.setActiveLeaf(existingLeaf, { focus: true });
        return true;
      }
    }

    // File not open or user wants new window/split - open it
    let leaf;
    
    if (split) {
      // Open in split view
      leaf = workspace.getLeaf('split');
    } else if (newWindow) {
      // Open in new tab/window
      leaf = workspace.getLeaf(true);
    } else {
      // Reuse existing window (default behavior)
      leaf = workspace.getLeaf(false);
    }
    
    await leaf.openFile(file);
    return true;
  } catch (error) {
    console.warn('Failed to open file in Obsidian:', error);
    return false;
  }
}

export function getDirectoryFromPath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    return '/';
  }
  
  // Remove leading slash to normalize path
  const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  
  // Find the last slash to separate directory from filename
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  
  // If no slash found, file is in root directory
  if (lastSlashIndex === -1) {
    return '/';
  }
  
  // Extract directory and ensure it starts with slash and ends with slash
  const directory = normalizedPath.substring(0, lastSlashIndex);
  return directory.startsWith('/') ? directory : `/${directory}/`;
}
