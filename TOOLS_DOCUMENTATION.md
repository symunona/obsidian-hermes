# Directory and Folder Tools Documentation

## Overview
Several tools are available to work with directories and folders in the vault:

## 1. `image_search` Tool
- **Purpose**: Search for images on the internet and save them to the vault
- **Parameters**: 
  - `query` (string, required) - The search query to find images
  - `count` (number, optional) - Number of images to download (default: 1, max: 5)
  - `folder` (string, optional) - Target folder path (defaults to current folder or assets folder)
  - `filename_prefix` (string, optional) - Prefix for generated filenames
- **Use Case**: When you need to find and save images for your notes
- **Features**: Automatically generates descriptive filenames, supports multiple image formats

### Example Usage:
```javascript
// Search for a single image
image_search({ query: "mountain landscape" })

// Search for multiple images with custom folder
image_search({ 
  query: "cats", 
  count: 3, 
  folder: "assets/pets",
  filename_prefix: "cute-cat"
})

// Search in current folder
image_search({ 
  query: "diagram flowchart",
  count: 2
})
```

### Example Output:
```javascript
{
  query: "mountain landscape",
  downloadedImages: [
    {
      filename: "mountain-landscape-1.jpg",
      filePath: "assets/mountain-landscape-1.jpg",
      url: "https://example.com/image.jpg",
      title: "Mountain Landscape",
      size: 245760,
      type: "jpg"
    }
  ],
  targetFolder: "assets",
  totalFound: 5,
  totalDownloaded: 1
}
```

## 2. `open_folder_in_system` Tool
- **Purpose**: Opens the specified folder in the system file browser/finder
- **Parameters**: `path` (string) - folder path relative to vault root, or "." for vault root
- **Use Case**: When you need to access a folder in your system's file manager
- **Cross-platform**: Works on Windows, macOS, and Linux

### Example Usage:
```javascript
// Open vault root
open_folder_in_system({ path: "." })

// Open specific folder
open_folder_in_system({ path: "documents/projects" })

// Open parent folder of a file
open_folder_in_system({ path: "notes/daily-note.md" })
```

## 3. `dirlist` Tool
- **Purpose**: Returns a hierarchical tree structure of directories only
- **Format**: Nested JSON object with `path` and `children` properties
- **Use Case**: When the AI needs to understand the complete folder hierarchy without file clutter

### Example Output:
```json
[
  {
    "path": "",
    "children": [
      {
        "path": "projects",
        "children": []
      },
      {
        "path": "research",
        "children": [
          {
            "path": "research/notes",
            "children": []
          }
        ]
      }
    ]
  }
]
```

## 4. `get_folder_tree` Tool (Enhanced)
- **Purpose**: Returns a flat array of all folder paths
- **Format**: Simple sorted array of folder paths
- **Use Case**: When the AI needs a quick overview of all available folders

### Example Output:
```javascript
[
  "/",
  "projects",
  "research",
  "research/notes"
]
```

## Key Differences

| Feature | image_search | open_folder_in_system | dirlist | get_folder_tree |
|---------|-------------|----------------------|---------|-----------------|
| Purpose | Download images | System integration | Hierarchical tree | Flat array |
| Action | Search & save | Opens external app | Returns structure | Returns list |
| File Info | Downloads images | N/A | Excluded completely | Excluded completely |
| Use Case | Image acquisition | External file access | Detailed hierarchy analysis | Quick folder overview |

## Implementation Details

### `image_search`:
- Uses web search APIs to find relevant images based on query
- Downloads images using fetch API and saves as binary data
- Automatically detects image format from URL or defaults to jpg
- Generates sanitized filenames based on query and index
- Creates target folders if they don't exist
- Limits downloads to 5 images per request to prevent abuse

### `open_folder_in_system`:
- Uses Obsidian's `vault.adapter.openPath()` method when available
- Falls back to platform-specific system commands (open/explorer/xdg-open)
- Works with both folder paths and file paths (opens parent directory for files)
- Validates path existence before attempting to open

### In Obsidian:
- `dirlist`: Uses `app.vault.getAllLoadedFiles()` and builds recursive tree
- `get_folder_tree`: Filters folders from `app.vault.getAllLoadedFiles()`

### In Mock Environment:
- Both use the `MOCK_FILES` object to extract folder paths
- `dirlist` builds parent-child relationships using a Map
- `get_folder_tree` extracts unique folder paths

## Usage Recommendations

- Use `image_search` when you need to find and save images for your notes
- Use `open_folder_in_system` when you need to access files/folders outside of Obsidian
- Use `dirlist` when you need to understand the complete folder structure and relationships
- Use `get_folder_tree` for a simple list of all folders
- All directory tools ignore files completely, focusing only on directory structure
