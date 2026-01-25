import { GoogleGenAI, Type } from "@google/genai";
import { loadAppSettings } from '../persistence/persistence';
import { createBinaryFile } from '../services/mockFiles';
import { getDirectoryFromPath } from '../utils/environment';

export const declaration = {
  name: 'generate_image_from_context',
  description: 'Generate an image based on the current context or provided prompt using Gemini API and save it to the vault.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: { type: Type.STRING, description: 'The prompt describing what image to generate. If not provided, will use current context.' },
      filename: { type: Type.STRING, description: 'The filename to save the image as (e.g., "generated-image.png"). If not provided, will auto-generate.' }
    },
    required: []
  }
};

export const instruction = `- generate_image_from_context: Use this to create images based on conversation context or specific prompts. Images are saved to the current vault directory.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  // Get API key from settings or environment
  const settings = loadAppSettings();
  const apiKey = settings?.manualApiKey?.trim() || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error('API key not found. Please set your Gemini API key in the plugin settings.');
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Use provided prompt or generate from context
  let prompt = args.prompt;
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
    let filename = args.filename;
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      filename = `generated-image-${timestamp}.png`;
    }

    // Ensure filename has proper extension
    if (!filename.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
      filename += '.png';
    }

    // Convert base64 to binary data and save
    const binaryData = Buffer.from(imageData, 'base64');
    
    // Debug: Log the actual data size and type
    console.log(`Image data length: ${imageData.length} characters`);
    console.log(`Binary data size: ${binaryData.byteLength} bytes`);
    console.log(`First 100 chars of base64: ${imageData.substring(0, 100)}`);
    
    // Save the image file using the proper binary file creation function
    await createBinaryFile(filename, binaryData);

    callbacks.onSystem(`Generated image: ${filename}`, {
      name: 'generate_image_from_context',
      filename: filename,
      newContent: `Generated image (${binaryData.byteLength} bytes)`,
      description: `Image generated from prompt: ${prompt}`
    });

    const imageDirectory = getDirectoryFromPath(filename);
    callbacks.onFileState(imageDirectory, filename);

    return { 
      filename, 
      size: binaryData.byteLength,
      description: `Image generated from prompt: ${prompt}`
    };

  } catch (error: any) {
    console.error('Image generation error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
  
    // Provide more specific error information
    let errorMessage = `Failed to generate image: ${error.message}`;
  
    if (error.message?.includes('model')) {
      errorMessage += '\n\nThis might be due to an incorrect model name or insufficient API permissions for image generation.';
    }
  
    if (error.message?.includes('API key')) {
      errorMessage += '\n\nPlease check your Gemini API key configuration.';
    }
  
    throw new Error(errorMessage);
  }
};
