/**
 * Web Search Provider abstraction layer
 * Supports pluggable search providers with consistent interface
 */

export type WebSearchProvider = 'google' | 'serpapi' | 'perplexity';

export interface SearchResult {
  text: string;
  sourceUrl?: string;
  metadata?: {
    provider: WebSearchProvider;
    duration: number;
    resultCount?: number;
    groundingChunks?: unknown[];
  };
}

export interface WebSearchProviderInterface {
  name: WebSearchProvider;
  execute(query: string, apiKey: string): Promise<SearchResult>;
  validate(apiKey: string): boolean;
}

/**
 * Google/Gemini Search Provider (current implementation)
 */
class GoogleSearchProvider implements WebSearchProviderInterface {
  name: WebSearchProvider = 'google';

  validate(apiKey: string): boolean {
    return apiKey && apiKey.trim().length > 0;
  }

  async execute(query: string, apiKey: string): Promise<SearchResult> {
    const startTime = performance.now();
    
    if (!this.validate(apiKey)) {
      throw new Error('Invalid Google API key');
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: query,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text || 'No results found.';
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const duration = Math.round(performance.now() - startTime);

      return {
        text,
        sourceUrl: undefined,
        metadata: {
          provider: 'google',
          duration,
          resultCount: groundingChunks.length,
          groundingChunks
        }
      };
    } catch (error) {
      throw new Error(`Google search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * SerpAPI Search Provider (faster alternative)
 */
class SerpAPIProvider implements WebSearchProviderInterface {
  name: WebSearchProvider = 'serpapi';

  validate(apiKey: string): boolean {
    return apiKey && apiKey.trim().length > 0;
  }

  async execute(query: string, apiKey: string): Promise<SearchResult> {
    const startTime = performance.now();
    
    if (!this.validate(apiKey)) {
      throw new Error('Invalid SerpAPI key');
    }

    try {
      const url = new URL('https://serpapi.com/search');
      url.searchParams.append('api_key', apiKey);
      url.searchParams.append('q', query);
      url.searchParams.append('engine', 'google');
      url.searchParams.append('num', '10');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.status}`);
      }

      const data = await response.json() as Record<string, unknown>;
      const results = (data.organic_results as Array<{title?: string; snippet?: string; link?: string}>) || [];
      
      if (results.length === 0) {
        return {
          text: 'No results found.',
          sourceUrl: undefined,
          metadata: {
            provider: 'serpapi',
            duration: Math.round(performance.now() - startTime),
            resultCount: 0
          }
        };
      }

      // Format results as readable text
      const text = results
        .map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\nURL: ${r.link}`)
        .join('\n\n');

      const duration = Math.round(performance.now() - startTime);

      return {
        text,
        sourceUrl: results[0]?.link,
        metadata: {
          provider: 'serpapi',
          duration,
          resultCount: results.length
        }
      };
    } catch (error) {
      throw new Error(`SerpAPI search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Perplexity Search Provider (optional, for future use)
 */
class PerplexityProvider implements WebSearchProviderInterface {
  name: WebSearchProvider = 'perplexity';

  validate(apiKey: string): boolean {
    return apiKey && apiKey.trim().length > 0;
  }

  async execute(query: string, apiKey: string): Promise<SearchResult> {
    const startTime = performance.now();
    
    if (!this.validate(apiKey)) {
      throw new Error('Invalid Perplexity API key');
    }

    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'pplx-7b-online',
          messages: [{ role: 'user', content: query }]
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status}`);
      }

      const data = await response.json() as {choices?: Array<{message?: {content?: string}}>};
      const text = data.choices?.[0]?.message?.content || 'No results found.';
      const duration = Math.round(performance.now() - startTime);

      return {
        text,
        sourceUrl: undefined,
        metadata: {
          provider: 'perplexity',
          duration
        }
      };
    } catch (error) {
      throw new Error(`Perplexity search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Provider Registry and Factory
 */
class WebSearchProviderRegistry {
  private providers: Map<WebSearchProvider, WebSearchProviderInterface>;

  constructor() {
    this.providers = new Map([
      ['google', new GoogleSearchProvider()],
      ['serpapi', new SerpAPIProvider()],
      ['perplexity', new PerplexityProvider()]
    ]);
  }

  getProvider(name: WebSearchProvider): WebSearchProviderInterface {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Unknown search provider: ${name}`);
    }
    return provider;
  }

  listProviders(): WebSearchProvider[] {
    return Array.from(this.providers.keys());
  }

  registerProvider(provider: WebSearchProviderInterface): void {
    this.providers.set(provider.name, provider);
  }
}

// Singleton registry
let registryInstance: WebSearchProviderRegistry | null = null;

export function getProviderRegistry(): WebSearchProviderRegistry {
  if (!registryInstance) {
    registryInstance = new WebSearchProviderRegistry();
  }
  return registryInstance;
}

export function getProvider(name: WebSearchProvider): WebSearchProviderInterface {
  return getProviderRegistry().getProvider(name);
}

export function listProviders(): WebSearchProvider[] {
  return getProviderRegistry().listProviders();
}
