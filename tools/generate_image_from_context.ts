import { GoogleGenAI, Type } from "@google/genai";
import { loadAppSettings } from '../persistence/persistence';
import { createBinaryFile } from '../services/vaultOperations';
import { getDirectoryFromPath, getObsidianApp } from '../utils/environment';
import type { ToolCallbacks } from '../types';
import { getErrorMessage } from '../utils/getErrorMessage';

type ToolArgs = Record<string, unknown>;

const getStringArg = (args: ToolArgs, key: string): string | undefined => {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
};

const decodeBase64ToUint8Array = (data: string): Uint8Array => {
  const binaryString = atob(data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const declaration = {
  name: 'generate_image_from_context',
  description: 'Generate an image based on the current context or provided prompt using Gemini API and save it to the vault.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: { type: Type.STRING, description: 'The prompt describing what image to generate. If not provided, will use current context.' },
      filename: { type: Type.STRING, description: 'The filename to save the image as (e.g., "generated-image.png"). If not provided, will auto-generate.' },
      currentFolder: { type: Type.STRING, description: 'The folder path where to save the image. If not provided, will use active file\'s folder.' }
    },
    required: []
  }
};

export const instruction = `- generate_image_from_context: Use this to create images based on conversation context or specific prompts. Images are saved to the current vault directory.`;

export const execute = async (args: ToolArgs, callbacks: ToolCallbacks): Promise<unknown> => {
  // Get API key from settings or environment
  const settings = loadAppSettings();
  const apiKey = settings?.manualApiKey?.trim();
  
  if (!apiKey) {
    throw new Error('API key not found. Please set your Gemini API key in the plugin settings.');
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Use provided prompt or generate from context
  let prompt = getStringArg(args, 'prompt');
  if (!prompt) {
    // Generate a prompt based on current conversation context
    prompt = "Generate an image based on the current conversation context and topic being discussed.";
  }
  
  try {
    // Generate image using Gemini's image generation capability
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt
    });

    // Extract image data from the response
    let imageData = '';
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            imageData = part.inlineData.data;
            break;
          }
        }
      }
    }

    if (!imageData) {
      throw new Error('No image data returned from API');
    }

    // Generate filename if not provided
    let filename = getStringArg(args, 'filename');
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      filename = `generated-image-${timestamp}.png`;
    }

    // Ensure filename has proper extension
    if (!filename.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
      filename += '.png';
    }

    // Convert base64 to binary data and save
    const binaryData = decodeBase64ToUint8Array(imageData);
    
    // DEBUG: Log the actual data size and type
    console.error('=== DEBUG generate_image_from_context: STARTING FILE SAVE ===');
    console.error(`DEBUG: Image data length: ${imageData.length} characters`);
    console.error(`DEBUG: Binary data size: ${binaryData.byteLength} bytes`);
    console.error(`DEBUG: First 100 chars of base64: ${imageData.substring(0, 100)}`);
    
    // Get current folder to save image in
    let currentFolder = getStringArg(args, 'currentFolder') || '';
    console.error(`DEBUG: currentFolder from args: "${currentFolder}"`);
    
    // If no currentFolder provided, try to get from active file as fallback
    if (!currentFolder) {
      const app = getObsidianApp();
      console.error(`DEBUG: getObsidianApp() returned: ${app ? 'app exists' : 'NULL'}`);
      if (app && app.workspace) {
        console.error(`DEBUG: app.workspace exists`);
        const activeFile = app.workspace.getActiveFile();
        console.error(`DEBUG: activeFile: ${activeFile ? activeFile.path : 'NULL'}`);
        if (activeFile && activeFile.parent) {
          currentFolder = activeFile.parent.path;
          console.error(`DEBUG: currentFolder from activeFile.parent: "${currentFolder}"`);
        } else {
          console.error(`DEBUG: No activeFile or no parent - currentFolder stays empty`);
        }
      } else {
        console.error(`DEBUG: No app or no workspace - currentFolder stays empty`);
      }
    }
    
    // Prepend current folder to filename if we have one
    const fullFilename = currentFolder ? `${currentFolder}/${filename}` : filename;
    console.error(`DEBUG: Final fullFilename to save: "${fullFilename}"`);
    console.error(`DEBUG: filename only: "${filename}"`);
    
    // Save the image file using the proper binary file creation function
    console.error(`DEBUG: About to call createBinaryFile with fullFilename="${fullFilename}", binaryData.byteLength=${binaryData.byteLength}`);
    try {
      const result = await createBinaryFile(fullFilename, binaryData);
      console.error(`DEBUG: createBinaryFile returned: "${result}"`);
    } catch (saveError) {
      console.error(`DEBUG: createBinaryFile THREW ERROR:`, saveError);
      throw saveError;
    }
    console.error('=== DEBUG generate_image_from_context: FILE SAVE COMPLETE ===');

    callbacks.onSystem(`Generated image: ${filename}`, {
      name: 'generate_image_from_context',
      filename: filename,
      newContent: `Generated image (${binaryData.byteLength} bytes)`,
      description: `Image generated from prompt: ${prompt}`
    });

    const imageDirectory = getDirectoryFromPath(fullFilename);
    callbacks.onFileState(imageDirectory, filename);

    return { 
      filename, 
      filePath: fullFilename,
      size: binaryData.byteLength,
      type: filename.split('.').pop() || 'png',
      targetFolder: currentFolder,
      description: `Image generated from prompt: ${prompt}`
    };

  } catch (error) {
    console.error('Image generation error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  
    // Provide more specific error information
    let errorMessage = `Failed to generate image: ${getErrorMessage(error)}`;
  
    if (getErrorMessage(error).includes('model')) {
      errorMessage += '\n\nThis might be due to an incorrect model name or insufficient API permissions for image generation.';
    }
  
    if (getErrorMessage(error).includes('API key')) {
      errorMessage += '\n\nPlease check your Gemini API key configuration.';
    }
  
    throw new Error(errorMessage);
  }
};
