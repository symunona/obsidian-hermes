# Hermes Voice Assistant for Obsidian

Hermes is a high-performance, interactive voice interface for your Obsidian vault. Powered by the **Gemini 2.5 Flash Native Audio** (Live API), it allows you to talk directly to your notes, perform complex file operations, and search the web—all via a low-latency voice channel.

## ✨ Features

- **Gemini Live Integration**: Natural, human-like voice conversations with real-time audio streaming
- **Vault Awareness**: Hermes can read your notes, list directories, and understand the context of your current folder
- **Smart Tool Calling**:
  - `read_file` / `create_file` / `update_file`: Full file lifecycle management
  - `edit_file`: Targeted line-based modifications
  - `search_keyword` / `search_regexp`: Global vault searching
  - `internet_search`: Real-time web grounding via Google Search
  - `generate_image_from_context`: AI-powered image generation
  - `topic_switch`: Automatic conversation archiving
- **Voice Personas**: Choose from different voices (Kore, Puck, Charon, Fenrir, Zephyr)
- **Automatic Archiving**: Using the `topic_switch` tool, Hermes can summarize segments of your conversation and save them as markdown notes in your vault
- **Hermes Interface**: A sleek, terminal-inspired UI with kernel logs, token usage tracking, and markdown previews

## 🚀 Installation

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` (if applicable)
2. Create a folder named `hermes-voice-assistant` in your vault's `.obsidian/plugins/` directory
3. Move the downloaded files into that folder
4. Reload Obsidian and enable **Hermes Voice Assistant** in the Community Plugins settings

### Configuration
- **API Key**: You must provide a Google Gemini API Key. You can enter this manually in the Hermes settings
- **Voice Persona**: Choose between different voices (Kore, Puck, Charon, Fenrir, Zephyr) in the settings panel
- **Custom Context**: Define specific behaviors or rules for the assistant (added to every session)
- **System Instructions**: Core logic instructions for the AI assistant
- **Chat History Folder**: Folder path where chat history will be saved (default: `Hermes/History`)

## 🛠 Developer Reference

### Project Structure
- `main.ts`: The entry point for the Obsidian plugin
- `HermesMainViewObsidian.tsx`: The Obsidian Workspace Leaf that hosts the React application
- `App.tsx`: The root React component managing state and the voice session
- `services/voiceInterface.ts`: Core logic for managing the `@google/genai` Live session, audio encoding/decoding, and tool execution
- `services/commands.ts`: Tool registry and execution engine
- `tools/`: Individual tool definitions (declarations and execution logic)
- `components/`: UI components (Chat, Tool Results, Settings, Kernel Log)
- `persistence/`: Settings and data persistence layer
- `utils/`: Utility functions for audio processing, environment detection, etc.

### Development Commands
```bash
# Install dependencies
pnpm install

# Start the build watcher (for development)
pnpm run dev

# Build for production
pnpm run build

# Build CSS only
pnpm run build-css

# Watch CSS changes
pnpm run watch-css

# Serve standalone version
pnpm run serve

# Development with standalone
pnpm run dev-standalone

# Build standalone version
pnpm run build-standalone
```

### Available Tools
The plugin includes 20+ tools for vault operations:

**File Management:**
- `read_file`: Read file contents
- `create_file`: Create new files
- `update_file`: Update entire file content
- `edit_file`: Line-based editing
- `delete_file`: Delete files
- `rename_file`: Rename files
- `move_file`: Move files between directories

**Directory Operations:**
- `list_directory`: List directory contents
- `list_vault_files`: List all vault files with filtering
- `get_folder_tree`: Get folder structure
- `dirlist`: Quick directory listing
- `create_directory`: Create new directories

**Search & Replace:**
- `search_keyword`: Search for text patterns
- `search_regexp`: Regex-based search
- `search_replace_file`: Search and replace in single file
- `search_replace_global`: Global search and replace

**Advanced Features:**
- `internet_search`: Web search via Google
- `generate_image_from_context`: AI image generation
- `topic_switch`: Archive conversation segments
- `end_conversation`: Graceful session termination

### Adding New Tools
To add a new capability to Hermes:
1. Create a new file in `tools/[tool_name].ts`
2. Define a `declaration` (OpenAPI schema) and an `execute` function
3. Add an entry to the `TOOLS` registry in `services/commands.ts`
4. Add the tool's usage instructions to `utils/defaultPrompt.ts`

### Tool Template
```typescript
export const declaration = {
  name: 'your_tool_name',
  description: 'Brief description of what the tool does',
  parameters: {
    type: Type.OBJECT,
    properties: {
      param1: { type: Type.STRING, description: 'Parameter description' }
    },
    required: ['param1']
  }
};

export const instruction = `- your_tool_name: Usage instructions for the AI`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  // Your tool implementation
  return { result: 'success' };
};
```

### Technical Stack
- **AI**: `@google/genai` (Gemini 2.5 Flash Native Audio)
- **UI**: React 19, Tailwind CSS (Typography plugin)
- **Markdown**: `marked` for real-time rendering
- **Build**: `esbuild` for plugin, `Vite` for standalone
- **Audio**: Web Audio API for real-time audio processing
- **Package Manager**: pnpm

### Plugin Architecture
- **Obsidian Integration**: Uses WorkspaceLeaf API for seamless integration
- **State Management**: React hooks with persistence layer
- **Audio Pipeline**: Real-time bidirectional audio streaming with Web Audio API
- **Tool Execution**: Async command pattern with error handling and logging
- **Settings Management**: Obsidian settings API with React synchronization

### Key Classes
- `HermesPlugin`: Main plugin class (extends Obsidian Plugin)
- `GeminiVoiceAssistant`: Voice interface implementation
- `HermesMainViewObsidian`: React view wrapper for Obsidian
- `HermesSettingsTab`: Plugin settings configuration

### Voice Configuration
Available voice personas:
- **Kore**: Professional and clear
- **Puck**: Friendly and conversational
- **Charon**: Deep and authoritative
- **Fenrir**: Energetic and dynamic
- **Zephyr**: Default balanced voice

## ⚙️ Commands

### Obsidian Commands
- `Open Hermes Assistant`: Open the voice assistant interface
- Ribbon icon: Quick access to Hermes

### Voice Commands
Speak naturally to Hermes to:
- "Read my notes" → Lists current directory
- "Create a new note called meeting-notes" → Creates file
- "Search for TODO items" → Searches vault
- "What's the weather today?" → Web search
- "Archive this conversation" → Saves chat history

## 🔧 Settings

### API Configuration
- **Gemini API Key**: Required for voice assistant functionality
- Get your key at: https://ai.google.dev/gemini-api/docs/billing

### Behavior Settings
- **Voice Persona**: Select voice character
- **Custom Context**: Add persistent context to all sessions
- **System Instructions**: Override default AI behavior
- **Chat History Folder**: Configure archive location

## 🐛 Troubleshooting

### Common Issues
1. **API Key Missing**: Configure in settings or check environment variables
2. **Audio Permissions**: Allow microphone access in browser
3. **Connection Issues**: Check network connectivity and API quota
4. **Large Vaults**: Use `list_vault_files` with limits for better performance

### Debug Information
Enable kernel logs in the interface to see:
- Connection status
- Tool execution details
- API call timing
- Error messages with stack traces

## ⚖️ License
MIT

---
*Hermes: Bridging the gap between thought and file.*