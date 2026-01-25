# Hermes Voice Assistant for Obsidian

Hermes is a high-performance, interactive voice interface for your Obsidian vault. Powered by the **Gemini 2.5 Flash Native Audio** (Live API), it allows you to talk directly to your notes, perform complex file operations, and search the web—all via a low-latency voice channel.

## ✨ Features

- **Gemini Live Integration**: Natural, human-like voice conversations with real-time audio streaming.
- **Vault Awareness**: Hermes can read your notes, list directories, and understand the context of your current folder.
- **Smart Tool Calling**:
  - `read_file` / `create_file` / `update_file`: Full file lifecycle management.
  - `edit_file`: Targeted line-based modifications.
  - `search_keyword` / `search_regexp`: Global vault searching.
  - `internet_search`: Real-time web grounding via Google Search.
- **Automatic Archiving**: Using the `topic_switch` tool, Hermes can summarize segments of your conversation and save them as markdown notes in your vault.
- **Hermes OS Interface**: A sleek, terminal-inspired UI with kernel logs, token usage tracking, and markdown previews.

## 🚀 Installation

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` (if applicable).
2. Create a folder named `hermes-voice-assistant` in your vault's `.obsidian/plugins/` directory.
3. Move the downloaded files into that folder.
4. Reload Obsidian and enable **Hermes Voice Assistant** in the Community Plugins settings.

### Configuration
- **API Key**: You must provide a Google Gemini API Key. You can enter this manually in the Hermes settings or use the "Google AI Studio Auth" button to select a key from a paid GCP project.
- **Voice Persona**: Choose between different voices (Zephyr, Kore, Puck, etc.) in the settings panel.

## 🛠 Developer Reference

### Project Structure
- `main.ts`: The entry point for the Obsidian plugin.
- `HermesView.tsx`: The Obsidian Workspace Leaf that hosts the React application.
- `App.tsx`: The root React component managing state and the voice session.
- `services/voiceInterface.ts`: Core logic for managing the `@google/genai` Live session, audio encoding/decoding, and tool execution.
- `tools/`: Individual tool definitions (declarations and execution logic).
- `components/`: UI components (Chat, Tool Results, Settings, Kernel Log).

### Development Commands
```bash
# Install dependencies
npm install

# Start the build watcher (for development)
npm run dev

# Build for production
npm run build
```

### Adding New Tools
To add a new capability to Hermes:
1. Create a new file in `tools/[tool_name].ts`.
2. Define a `declaration` (OpenAPI schema) and an `execute` function.
3. Add an entry to the `TOOLS` registry in `services/commands.ts`.
4. Add the tool's usage instructions to `defaultPrompt.ts`.

### Technical Stack
- **AI**: `@google/genai` (Gemini 2.5 Flash Native Audio)
- **UI**: React 19, Tailwind CSS (Typography plugin)
- **Markdown**: `marked` for real-time rendering.
- **Build**: `esbuild`

## ⚖️ License
MIT

---
*Hermes: Bridging the gap between thought and file.*