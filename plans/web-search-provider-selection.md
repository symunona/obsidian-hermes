# Plan: Web Search Provider Selection & Implementation

## Problem Statement
The current `internet_search` tool uses Google's Gemini API with built-in Google Search grounding, which is slow (often 18+ seconds). We need to evaluate and integrate faster alternative web search providers.

## Solution Overview
Implement a pluggable web search provider system that allows users to:
1. Select their preferred search provider (Google Search, SerpAPI, Perplexity, etc.)
2. Configure API keys per provider
3. Fall back gracefully if a provider is unavailable
4. Measure performance metrics per provider

## Architecture Changes

### New Services
- **`services/webSearchProviders.ts`** - Provider registry & factory pattern
  - Abstract interface for web search providers
  - Pluggable provider implementations
  - Provider selection logic

### New Tools (Minimal Impact on Existing Code)
- Update `tools/web_search.ts` to use provider system
- No changes needed to tool declaration (same interface)
- Provider abstraction handles differences transparently

### Settings Updates
- Add `webSearchProvider` (enum: 'google', 'serpapi', 'perplexity', etc.)
- Add provider-specific API keys: `serpApiKey`, `perplexityApiKey`, etc.
- Settings UI to display available/configured providers

### Component Updates
- Minimal: Settings page needs new provider selection dropdowns

## Implementation Steps

### Phase 1: Provider Abstraction (Core)
1. Create `services/webSearchProviders.ts`
   - Define `WebSearchProvider` interface
   - Base implementation template
   - Provider registry

2. Create provider implementations:
   - `providers/google.ts` - Current Gemini integration
   - `providers/serpapi.ts` - SerpAPI (likely faster)
   - `providers/perplexity.ts` - Perplexity API (optional)

3. Update `tools/web_search.ts`
   - Load selected provider from settings
   - Execute query via provider interface
   - Return consistent format (text + metadata)

### Phase 2: Settings Integration
1. Update `types.ts` - Add provider settings
2. Update persistence layer - Store provider config
3. Settings UI component - Add dropdowns and API key inputs

### Phase 3: Testing & Metrics
1. Add performance logging per provider
2. Test fallback behavior
3. Document provider-specific options/limits

## Expected Outcomes
- Users can switch between providers via settings
- Faster search response times (target: <5s via SerpAPI)
- Graceful degradation if selected provider is unavailable
- Performance metrics in system messages for transparency

## Risks & Considerations
- **Cost**: Each provider has different pricing; SerpAPI has free tier
- **Compatibility**: Response formats vary; need normalization layer
- **API Limits**: Rate limiting differences between providers
- **Dependencies**: May add new npm packages for provider SDKs

## Testing Strategy
- Unit tests for provider implementations
- Integration tests for fallback logic
- Manual testing with different providers
- Performance benchmarks
