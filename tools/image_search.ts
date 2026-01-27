import { getObsidianApp } from '../utils/environment';
import { ToolData } from '../types';
import { loadAppSettings } from '../persistence/persistence';

export const declaration = {
  name: 'image_search',
  description: 'Search for images on the internet and preview them. Click on any image in the preview to download it to the vault.',
  parameters: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'The search query to find images.' },
      count: { type: 'number', description: 'Number of images to show in preview (default: 3, max: 10).' },
      auto_download: { type: 'boolean', description: 'Whether to automatically download images (default: false).' },
      folder: { type: 'string', description: 'Target folder path (optional, defaults to current folder or assets folder).' },
      filename_prefix: { type: 'string', description: 'Prefix for generated filenames (optional).' }
    },
    required: ['query']
  }
};

export const instruction = `- image_search: Use this to search for images and preview them. Click on any image in the preview to download it to the vault.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const app = getObsidianApp();
  
  if (!app || !app.vault) {
    callbacks.onSystem('Error: Not running in Obsidian or vault unavailable', {
      name: 'image_search',
      filename: 'Image Search',
      error: 'Obsidian vault not available'
    });
    return { error: 'Obsidian vault not available' };
  }

  const { query, count = 3, auto_download = false, folder, filename_prefix } = args;

  try {
    // Send initial pending message
    callbacks.onSystem(`Image Search: ${query}`, {
      name: 'image_search',
      filename: query,
      status: 'pending'
    });

    // Validate count
    const imageCount = Math.min(Math.max(1, parseInt(count) || 3), 10);

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
    console.log('=== DEBUG: Search Results ===');
    console.log('Total search results found:', searchResults.length);
    console.log('Results for preview:', previewResults);
    console.log('Auto download:', auto_download);
    console.log('=== END DEBUG: Search Results ===');
    
    callbacks.onSystem(`Found ${searchResults.length} images for "${query}". Click any image to download:`, {
      name: 'image_search',
      filename: query,
      status: 'search_results',
      searchResults: previewResults,
      totalFound: searchResults.length,
      targetFolder
    });

    // If auto_download is enabled, download the images
    if (auto_download) {
      const downloadedImages = [];
      
      // Download and save each image
      for (let i = 0; i < Math.min(previewResults.length, imageCount); i++) {
        const imageResult = previewResults[i];
        try {
          const downloadedImage = await downloadAndSaveImage(
            app, 
            imageResult, 
            targetFolder, 
            filename_prefix || query,
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
      auto_download
    };
    
  } catch (error) {
    callbacks.onSystem('Error during image search and download', {
      name: 'image_search',
      filename: query,
      status: 'error',
      error: error.message || String(error)
    });
    return { error: error.message || String(error) };
  }
};

// Helper function to open Obsidian settings
function openObsidianSettings(): void {
  try {
    // @ts-ignore - Obsidian API
    const { app } = window;
    if (app && app.setting) {
      app.setting.open();
      // Navigate to our plugin's settings tab
      app.setting.openTabById('hermes-voice-assistant');
    }
  } catch (error) {
    console.warn('Failed to open Obsidian settings:', error);
  }
}

// Helper function to search for images using Serper.dev API
async function searchImages(query: string, count: number): Promise<any[]> {
  try {
    // Reload settings to get latest configuration
    const settings = await import('../persistence/persistence').then(p => p.reloadAppSettings());
    const serperApiKey = settings?.serperApiKey?.trim();
    
    if (!serperApiKey) {
      console.error('Serper API key not found');
      // Open settings so user can configure the API key
      openObsidianSettings();
      throw new Error('Serper API key not found. Please set your Serper API key in the plugin settings. Get 2,500 free credits at https://serper.dev/');
    }
    
    // Serper.dev Images API endpoint
    const searchUrl = 'https://google.serper.dev/images';
    
    console.log('Fetching images from Serper.dev API...');
    const response = await fetch(searchUrl, {
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
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Serper API error:', response.status, errorText);
      if (response.status === 401 || response.status === 403) {
        openObsidianSettings();
        throw new Error('Invalid Serper API key. Please check your API key in the plugin settings.');
      }
      throw new Error(`Serper API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.images || data.images.length === 0) {
      console.log('No images found for query:', query);
      return [];
    }
    
    // Map Serper results to our format
    const results = data.images.map((item: any) => ({
      url: item.imageUrl,
      title: item.title,
      description: item.source || '',
      thumbnailUrl: item.thumbnailUrl || item.imageUrl,
      contextUrl: item.link,
      width: item.imageWidth,
      height: item.imageHeight
    }));
    
    console.log(`Found ${results.length} images for query: ${query}`);
    return results;
  } catch (error) {
    console.error('Image search error:', error);
    throw error;
  }
}

// Helper function to download and save an image
async function downloadAndSaveImage(
  app: any, 
  imageResult: any, 
  targetFolder: string, 
  filenamePrefix: string,
  index: number
): Promise<any> {
  try {
    // Debug: Log input parameters
    console.log('=== DEBUG: downloadAndSaveImage ===');
    console.log('Image result:', imageResult);
    console.log('Target folder:', targetFolder);
    console.log('Filename prefix:', filenamePrefix);
    console.log('Index:', index);
    
    // Generate filename
    const sanitizedPrefix = filenamePrefix.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 20);
    
    const extension = getImageExtension(imageResult.url) || 'jpg';
    const filename = `${sanitizedPrefix}-${index}.${extension}`;
    const filePath = targetFolder ? `${targetFolder}/${filename}` : filename;

    // Debug: Log generated filename info
    console.log('Generated filename:', filename);
    console.log('File path:', filePath);
    console.log('Extension:', extension);

    // Download image
    console.log('Starting download from URL:', imageResult.url);
    const response = await fetch(imageResult.url);
    console.log('Fetch response status:', response.status);
    console.log('Fetch response headers:', response.headers);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    
    // Debug: Log download info
    console.log('Downloaded image size:', imageBuffer.byteLength, 'bytes');
    console.log('Buffer type:', imageBuffer.constructor.name);

    // Save to vault
    console.log('Saving to vault at path:', filePath);
    await app.vault.adapter.writeBinary(filePath, imageBuffer);
    console.log('Successfully saved to vault');

    const result = {
      filename,
      filePath,
      url: imageResult.url,
      title: imageResult.title,
      size: imageBuffer.byteLength,
      type: extension
    };
    
    // Debug: Log final result
    console.log('Download result:', result);
    console.log('=== END DEBUG: downloadAndSaveImage ===');
    
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
  } catch (error) {
    return null;
  }
}
