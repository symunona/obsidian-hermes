import { getObsidianApp } from '../utils/environment';
import { requestUrl, type App } from 'obsidian';
import { Type } from '@google/genai';
import type { ToolCallbacks, ImageSearchResult, DownloadedImage } from '../types';
import { reloadAppSettings } from '../persistence/persistence';
import { getErrorMessage } from '../utils/getErrorMessage';

export const declaration = {
  name: 'image_search',
  description: 'Search for images on the internet and preview them. Click on any image in the preview to download it to the vault.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'The search query to find images.' },
      count: { type: Type.NUMBER, description: 'Number of images to show in preview (default: 3, max: 10).' },
      auto_download: { type: Type.BOOLEAN, description: 'Whether to automatically download images (default: false).' },
      folder: { type: Type.STRING, description: 'Target folder path (optional, defaults to current folder or assets folder).' },
      filename_prefix: { type: Type.STRING, description: 'Prefix for generated filenames (optional).' }
    },
    required: ['query']
  }
};

export const instruction = `- image_search: Use this to search for images and preview them. Click on any image in the preview to download it to the vault.`;

type ToolArgs = Record<string, unknown>;

const getStringArg = (args: ToolArgs, key: string): string | undefined => {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
};

const getNumberArg = (args: ToolArgs, key: string, fallback: number): number => {
  const value = args[key];
  return typeof value === 'number' ? value : fallback;
};

const getBooleanArg = (args: ToolArgs, key: string, fallback: boolean): boolean => {
  const value = args[key];
  return typeof value === 'boolean' ? value : fallback;
};

export const execute = async (args: ToolArgs, callbacks: ToolCallbacks): Promise<unknown> => {
  const app = getObsidianApp();
  
  if (!app || !app.vault) {
    callbacks.onSystem('Error: Not running in Obsidian or vault unavailable', {
      name: 'image_search',
      filename: 'Image Search',
      error: 'Obsidian vault not available'
    });
    return { error: 'Obsidian vault not available' };
  }

  const query = getStringArg(args, 'query');
  const count = getNumberArg(args, 'count', 3);
  const autoDownload = getBooleanArg(args, 'auto_download', false);
  const folder = getStringArg(args, 'folder');
  const filenamePrefix = getStringArg(args, 'filename_prefix');

  if (!query) {
    return { error: 'Missing image search query' };
  }

  try {
    // Send initial pending message
    callbacks.onSystem(`Image search: ${query}`, {
      name: 'image_search',
      filename: query,
      status: 'pending'
    });

    // Validate count
    const imageCount = Math.min(Math.max(1, Math.floor(count) || 3), 10);

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

    // Search for images using a web search API
    const searchResults = await searchImages(query, Math.max(imageCount, 3));
    
    if (!searchResults || searchResults.length === 0) {
      callbacks.onSystem('No images found for the search query', {
        name: 'image_search',
        filename: query,
        status: 'error',
        error: 'No images found'
      });
      return { error: 'No images found for the search query' };
    }

    // Display search results in preview mode
    const previewResults = searchResults.slice(0, imageCount);
    console.debug('=== DEBUG: Search Results ===');
    console.debug('Total search results found:', searchResults.length);
    console.debug('Results for preview:', previewResults);
    console.debug('Auto download:', autoDownload);
    console.debug('=== END DEBUG: Search Results ===');
    
    callbacks.onSystem(`Found ${searchResults.length} images for "${query}". Click any image to download:`, {
      name: 'image_search',
      filename: query,
      status: 'search_results',
      searchResults: previewResults,
      totalFound: searchResults.length,
      targetFolder
    });

    // If auto_download is enabled, download the images
    if (autoDownload) {
      const downloadedImages: DownloadedImage[] = [];
      
      // Download and save each image
      for (let i = 0; i < Math.min(previewResults.length, imageCount); i++) {
        const imageResult = previewResults[i];
        try {
          const downloadedImage = await downloadAndSaveImage(
            app, 
            imageResult, 
            targetFolder, 
            filenamePrefix || query,
            i + 1
          );
          downloadedImages.push(downloadedImage);
        } catch (error) {
          console.error(`Failed to download image ${i + 1}:`, error);
        }
      }

      if (downloadedImages.length > 0) {
        // Format success message
        const successMessage = `Downloaded ${downloadedImages.length} image${downloadedImages.length > 1 ? 's' : ''} to ${targetFolder}`;
        
        callbacks.onSystem(successMessage, {
          name: 'image_search',
          filename: query,
          status: 'success',
          downloadedImages
        });

        return {
          query,
          downloadedImages,
          targetFolder,
          totalFound: searchResults.length,
          totalDownloaded: downloadedImages.length
        };
      }
    }

    return {
      query,
      searchResults: previewResults,
      targetFolder,
      totalFound: searchResults.length,
      auto_download: autoDownload
    };
    
  } catch (error) {
    console.error('Image search error:', error);
    callbacks.onSystem('Error during image search and download', {
      name: 'image_search',
      filename: query,
      status: 'error',
      error: getErrorMessage(error)
    });
    return { error: getErrorMessage(error) };
  }
};

// Helper function to open Obsidian settings
function openObsidianSettings(): void {
  const app = getObsidianApp();
  if (app && (app as unknown as { setting?: { open: () => void; openTabById: (id: string) => void } }).setting) {
    (app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } }).setting.open();
    // Navigate to our plugin's settings tab
    (app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } }).setting.openTabById('hermes-voice-assistant');
  }
}

// Helper function to search for images using Serper.dev API
type SerperImageResult = {
  imageUrl: string;
  title: string;
  source?: string;
  thumbnailUrl?: string;
  link?: string;
  imageWidth?: number;
  imageHeight?: number;
};

async function searchImages(query: string, count: number): Promise<ImageSearchResult[]> {
  try {
    // Reload settings to get latest configuration
    const settings = await reloadAppSettings();
    const serperApiKey = settings?.serperApiKey?.trim();
    
    if (!serperApiKey) {
      console.error('Serper API key not found');
      // Open settings so user can configure the API key
      openObsidianSettings();
      throw new Error('Serper API key not found. Please set your Serper API key in the plugin settings. Get 2,500 free credits at https://serper.dev/');
    }
    
    // Serper.dev Images API endpoint
    const searchUrl = 'https://google.serper.dev/images';
    
    console.debug('Fetching images from Serper.dev API...');
    const response = await requestUrl({
      url: searchUrl,
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: Math.min(count, 10)
      })
    });

    if (response.status >= 400) {
      console.error('Serper API error:', response.status, response.text);
      if (response.status === 401 || response.status === 403) {
        openObsidianSettings();
        throw new Error('Invalid Serper API key. Please check your API key in the plugin settings.');
      }
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = response.json as { images?: SerperImageResult[] };
    
    if (!data.images || data.images.length === 0) {
      console.debug('No images found for query:', query);
      return [];
    }
    
    // Map Serper results to our format
    const results = data.images.map((item) => ({
      url: item.imageUrl,
      title: item.title,
      description: item.source || '',
      image: {
        thumbnail: item.thumbnailUrl || item.imageUrl,
        contextLink: item.link,
        width: item.imageWidth,
        height: item.imageHeight
      }
    }));
    
    console.debug(`Found ${results.length} images for query: ${query}`);
    return results;
  } catch (error) {
    console.error('Image search error:', error);
    throw error;
  }
}

// Helper function to download and save an image
async function downloadAndSaveImage(
  app: App,
  imageResult: ImageSearchResult,
  targetFolder: string,
  filenamePrefix: string,
  index: number
): Promise<DownloadedImage> {
  try {
    // Debug: Log input parameters
    console.debug('=== DEBUG: downloadAndSaveImage ===');
    console.debug('Image result:', imageResult);
    console.debug('Target folder:', targetFolder);
    console.debug('Filename prefix:', filenamePrefix);
    console.debug('Index:', index);
    
    // Generate filename with timestamp to ensure uniqueness
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sanitizedPrefix = filenamePrefix.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 20);
    
    const extension = getImageExtension(imageResult.url) || 'jpg';
    const filename = `${sanitizedPrefix}-${index}-${timestamp}-${randomSuffix}.${extension}`;
    const filePath = targetFolder ? `${targetFolder}/${filename}` : filename;

    // Debug: Log generated filename info
    console.debug('Generated filename:', filename);
    console.debug('File path:', filePath);
    console.debug('Extension:', extension);

    // Download image
    console.debug('Starting download from URL:', imageResult.url);
    const response = await requestUrl({
      url: imageResult.url,
      method: 'GET'
    });

    if (response.status >= 400) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const imageBuffer = response.arrayBuffer;

    // Debug: Log download info
    console.debug('Downloaded image size:', imageBuffer.byteLength, 'bytes');
    console.debug('Buffer type:', imageBuffer.constructor.name);

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
      type: extension
    };
    
    // Debug: Log final result
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
