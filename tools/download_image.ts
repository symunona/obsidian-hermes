import { getObsidianApp } from '../utils/environment';
import { ToolData } from '../types';

export const declaration = {
  name: 'download_image',
  description: 'Download a specific image from a URL to the vault.',
  parameters: {
    type: 'object' as const,
    properties: {
      imageUrl: { type: 'string', description: 'The URL of the image to download.' },
      title: { type: 'string', description: 'The title of the image for filename generation.' },
      query: { type: 'string', description: 'The original search query for filename context.' },
      index: { type: 'number', description: 'The index of the image in search results.' },
      folder: { type: 'string', description: 'Target folder path (optional).' }
    },
    required: ['imageUrl', 'title', 'query']
  }
};

export const instruction = `- download_image: Use this to download a specific image from a URL to the vault.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  const app = getObsidianApp();
  
  if (!app || !app.vault) {
    callbacks.onSystem('Error: Not running in Obsidian or vault unavailable', {
      name: 'download_image',
      filename: 'Image Download',
      error: 'Obsidian vault not available'
    });
    return { error: 'Obsidian vault not available' };
  }

  const { imageUrl, title, query, index = 1, folder } = args;

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
      downloadedImage
    });

    return downloadedImage;
    
  } catch (error) {
    callbacks.onSystem('Error downloading image', {
      name: 'download_image',
      filename: title,
      status: 'error',
      error: error.message || String(error)
    });
    return { error: error.message || String(error) };
  }
};

// Helper function to download and save an image
async function downloadAndSaveImage(
  app: any, 
  imageResult: { url: string, title: string }, 
  targetFolder: string, 
  query: string,
  index: number
): Promise<any> {
  try {
    // Generate filename
    const sanitizedPrefix = query.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 20);
    
    const extension = getImageExtension(imageResult.url) || 'jpg';
    const filename = `${sanitizedPrefix}-${index}.${extension}`;
    const filePath = targetFolder ? `${targetFolder}/${filename}` : filename;

    console.log('=== DEBUG: downloadAndSaveImage ===');
    console.log('Image URL:', imageResult.url);
    console.log('Target folder:', targetFolder);
    console.log('Filename:', filename);
    console.log('File path:', filePath);

    // Download image
    const response = await fetch(imageResult.url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    console.log('Downloaded image size:', imageBuffer.byteLength, 'bytes');

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
      type: extension,
      targetFolder
    };
    
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
