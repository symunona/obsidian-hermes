
import { GoogleGenAI, Type } from "@google/genai";
import { loadAppSettings } from '../persistence/persistence';

export const declaration = {
  name: 'internet_search',
  description: 'Search the internet for real-time information, news, current events, or general knowledge outside the vault.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'The search query to look up on the web.' }
    },
    required: ['query']
  }
};

export const instruction = `- internet_search: Use this to fetch real-time data or information not contained within the local vault. Always use this tool for questions about current events, celebrities, weather, or general knowledge.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  // Get API key from settings or environment
  const settings = loadAppSettings();
  const apiKey = settings?.manualApiKey?.trim() || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error('API key not found. Please set your Gemini API key in the plugin settings.');
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: args.query,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const text = response.text || "No results found.";
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  // Create system message with search results
  callbacks.onSystem(`Internet Search: ${args.query}`, {
    name: 'internet_search',
    filename: 'Web',
    status: 'success',
    newContent: text,
    groundingChunks: groundingChunks
  });

  return { 
    text, 
    groundingChunks,
    searchQuery: args.query
  };
};
