import { Type } from "@google/genai";
import { loadAppSettings } from '../persistence/persistence';
import { getProvider, type WebSearchProvider } from '../services/webSearchProviders';
import type { ToolCallbacks } from '../types';

type ToolArgs = Record<string, unknown>;

const getStringArg = (args: ToolArgs, key: string): string | undefined => {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
};

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

export const execute = async (args: ToolArgs, callbacks: ToolCallbacks): Promise<{ text: string; groundingChunks: unknown[]; searchQuery: string }> => {
  const query = getStringArg(args, 'query');
  if (!query) {
    throw new Error('Missing query');
  }

  callbacks.onSystem(`Internet search: ${query}`, {
    name: 'internet_search',
    filename: query,
    status: 'pending'
  });

  const settings = loadAppSettings();
  const provider: WebSearchProvider = settings?.webSearchProvider || 'google';

  // Get API key based on provider
  let apiKey: string | undefined;
  if (provider === 'serpapi') {
    apiKey = settings?.serperApiKey?.trim();
  } else if (provider === 'perplexity') {
    apiKey = settings?.perplexityApiKey?.trim();
  } else {
    apiKey = settings?.manualApiKey?.trim();
  }

  if (!apiKey) {
    throw new Error(`No API key found for provider: ${provider}. Please configure it in settings.`);
  }

  try {
    const providerInstance = getProvider(provider);
    const result = await providerInstance.execute(query, apiKey);

    const { text, metadata } = result;
    const duration = metadata?.duration || 0;
    const responseLength = text.length;
    const groundingChunks = metadata?.groundingChunks || [];

    callbacks.onSystem(`Internet search: ${query}`, {
      name: 'internet_search',
      filename: query,
      status: 'success',
      newContent: text,
      groundingChunks: groundingChunks,
      duration: duration,
      responseLength: responseLength,
      description: `Provider: ${provider} (${duration}ms)`
    });

    return { 
      text, 
      groundingChunks,
      searchQuery: query
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    callbacks.onSystem(`Search failed: ${errorMsg}`, {
      name: 'internet_search',
      filename: query,
      status: 'error',
      error: errorMsg
    });
    throw error;
  }
};
