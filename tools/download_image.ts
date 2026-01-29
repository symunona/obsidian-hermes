import { getObsidianApp } from '../utils/environment';
import { requestUrl, type App } from 'obsidian';
import { Type } from '@google/genai';
import type { ToolCallbacks, DownloadedImage } from '../types';
import { getErrorMessage } from '../utils/getErrorMessage';

type ToolArgs = Record<string, unknown>;

const getStringArg = (args: ToolArgs, key: string): string | undefined => {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
};

const getNumberArg = (args: ToolArgs, key: string, fallback: number): number => {
  const value = args[key];
  return typeof value === 'number' ? value : fallback;
};

export const declaration = {
  name: 'download_image',
  description: 'Download a specific image from a URL to the vault.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      imageUrl: { type: Type.STRING, description: 'The URL of the image to download.' },
      title: { type: Type.STRING, description: 'The title of the image for filename generation.' },
      query: { type: Type.STRING, description: 'The original search query for filename context.' },
      index: { type: Type.NUMBER, description: 'The index of the image in search results.' },
      folder: { type: Type.STRING, description: 'Target folder path (optional).' }
    },
    required: ['imageUrl', 'title', 'query']
  }
};

export const instruction = `- download_image: Use this to download a specific image from a URL to the vault.`;

export const execute = async (args: ToolArgs, callbacks: ToolCallbacks): Promise<DownloadedImage | { error: string }> => {
  const app = getObsidianApp();
  
  if (!app || !app.vault) {
    callbacks.onSystem('Error: Not running in Obsidian or vault unavailable', {
      name: 'download_image',
      filename: 'Image Download',
      error: 'Obsidian vault not available'
    });
    return { error: 'Obsidian vault not available' };
  }

  const imageUrl = getStringArg(args, 'imageUrl');
  const title = getStringArg(args, 'title');
  const query = getStringArg(args, 'query');
  const index = getNumberArg(args, 'index', 1);
  const folder = getStringArg(args, 'folder');

  if (!imageUrl || !title || !query) {
    return { error: 'Missing required image download parameters' };
  }

  try {
    // Determine target folder
    let targetFolder = folder;
    if (!targetFolder) {
      // Try to get current active file's folder
      const activeFile = app.workspace.getActiveFile();
      if (activeFile) {
        const fileDir = activeFile.parent?.path;
        targetFolder = fileDir || '';
      } else {
        // Fallback to root or create an assets folder
        targetFolder = 'assets';
      }
    }

    // Ensure target folder exists
    if (targetFolder && !(await app.vault.adapter.exists(targetFolder))) {
      await app.vault.createFolder(targetFolder);
    }

    // Download and save the image
    const downloadedImage = await downloadAndSaveImage(
      app, 
      { url: imageUrl, title }, 
      targetFolder, 
      query,
      index
    );

    callbacks.onSystem(`Downloaded image: ${downloadedImage.filename}`, {
      name: 'download_image',
      filename: downloadedImage.filename,
      status: 'success',
      downloadedImages: [downloadedImage]
    });

    return downloadedImage;
    
  } catch (error) {
    console.error('Download image error:', error);
    callbacks.onSystem('Error downloading image', {
      name: 'download_image',
      filename: title,
      status: 'error',
      error: getErrorMessage(error)
    });
    return { error: getErrorMessage(error) };
  }
};

// Helper function to download and save an image
async function downloadAndSaveImage(
  app: App,
  imageResult: { url: string; title: string },
  targetFolder: string,
  query: string,
  index: number
): Promise<DownloadedImage> {
  try {
    // Generate filename with timestamp to ensure uniqueness
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sanitizedPrefix = query.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 20);
    
    const extension = getImageExtension(imageResult.url) || 'jpg';
    const filename = `${sanitizedPrefix}-${index}-${timestamp}-${randomSuffix}.${extension}`;
    const filePath = targetFolder ? `${targetFolder}/${filename}` : filename;

    console.debug('=== DEBUG: downloadAndSaveImage ===');
    console.debug('Image URL:', imageResult.url);
    console.debug('Target folder:', targetFolder);
    console.debug('Filename:', filename);
    console.debug('File path:', filePath);

    // Download image
    const response = await requestUrl({
      url: imageResult.url,
      method: 'GET'
    });

    const imageBuffer = response.arrayBuffer;
    console.debug('Downloaded image size:', imageBuffer.byteLength, 'bytes');

    // Save to vault
    console.debug('Saving to vault at path:', filePath);
    await app.vault.adapter.writeBinary(filePath, imageBuffer);
    console.debug('Successfully saved to vault');

    const result = {
      filename,
      filePath,
      url: imageResult.url,
      title: imageResult.title,
      size: imageBuffer.byteLength,
      type: extension,
      targetFolder
    };
    
    console.debug('Download result:', result);
    console.debug('=== END DEBUG: downloadAndSaveImage ===');
    
    return result;
  } catch (error) {
    console.error('=== DEBUG ERROR: downloadAndSaveImage ===');
    console.error('Error details:', error);
    console.error('Image result that failed:', imageResult);
    console.error('=== END DEBUG ERROR ===');
    throw error;
  }
}

// Helper function to get image extension from URL
function getImageExtension(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const lastDot = pathname.lastIndexOf('.');
    
    if (lastDot > 0) {
      const extension = pathname.substring(lastDot + 1).toLowerCase();
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
      return validExtensions.includes(extension) ? extension : null;
    }
    
    return null;
  } catch {
    return null;
  }
}
