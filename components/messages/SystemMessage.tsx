import React, { useState, useEffect } from 'react';
import { ToolData, SearchResult, SearchMatch, ImageSearchResult, DownloadedImage, GroundingChunk, DirectoryInfoItem } from '../../types';
import MarkdownRenderer from '../MarkdownRenderer';
import { COMMAND_DECLARATIONS } from '../../services/commands';
import { openFileInObsidian } from '../../utils/environment';

// ImageSearchResultsView component for interactive image preview
const ImageSearchResultsView: React.FC<{ 
  searchResults: ImageSearchResult[], 
  query: string, 
  totalFound: number, 
  onImageDownload?: (image: ImageSearchResult, index: number) => Promise<DownloadedImage | undefined> | void 
}> = ({ searchResults, query, totalFound, onImageDownload }) => {
  const [downloadingImages, setDownloadingImages] = useState<Set<number>>(new Set());
  const [downloadedImages, setDownloadedImages] = useState<Set<number>>(new Set());
  const [downloadedImageData, setDownloadedImageData] = useState<Map<number, DownloadedImage>>(new Map());
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  const handleImageClick = async (result: ImageSearchResult, index: number) => {
    if (downloadingImages.has(index) || downloadedImages.has(index)) return;

    setDownloadingImages(prev => new Set(prev).add(index));

    try {
      // Call the onImageDownload callback if provided
      if (onImageDownload) {
        // Add query context to the image object
        const imageWithContext = {
          ...result,
          query: query,
          originalQuery: query
        };
        const downloadResult = await onImageDownload(imageWithContext, index);
        
        // Store the downloaded image data (including filename)
        if (downloadResult) {
          setDownloadedImageData(prev => new Map(prev).set(index, downloadResult));
        }
      }
      
      // Mark as downloaded
      setDownloadedImages(prev => new Set(prev).add(index));
    } catch (error) {
      console.error('Error downloading image:', error);
    } finally {
      setDownloadingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(index);
        return newSet;
      });
    }
  };

  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <div className="pb-4 border-b border-gray-800 mb-4">
        <div className="text-sm font-medium text-gray-200 mb-2">
          Found {totalFound} images for "{query}"
        </div>
        <div className="text-xs text-gray-500">
          Click any image to download it to your vault
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {searchResults.map((result, i) => {
          const isDownloading = downloadingImages.has(i);
          const isDownloaded = downloadedImages.has(i);
          const hasImageError = imageErrors.has(i);
          
          return (
            <div 
              key={i} 
              className={`flex items-center space-x-3 p-3 rounded-xl bg-gray-800/30 border border-gray-700/30 transition-all group ${
                !isDownloaded ? 'cursor-pointer hover:bg-gray-700/20 hover:scale-[1.02]' : ''
              }`}
              onClick={() => !isDownloaded && handleImageClick(result, i)}
            >
              <div className="w-16 h-16 rounded-lg bg-gray-600/20 flex items-center justify-center shrink-0 border border-gray-600/20 overflow-hidden relative">
                <img 
                  src={result.url} 
                  alt={result.title}
                  className={`w-full h-full object-cover transition-all ${
                    !isDownloaded ? 'group-hover:scale-110' : ''
                  } ${isDownloading ? 'opacity-50' : ''} ${hasImageError ? 'hermes-image-fallback-hidden' : ''}`}
                  onError={() => {
                    setImageErrors(prev => new Set(prev).add(i));
                  }}
                />
                <svg className={`w-6 h-6 text-blue-400 ${hasImageError ? '' : 'hidden'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                
                {/* Overlay for download states */}
                {isDownloading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                
                {isDownloaded && (
                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex flex-col truncate flex-1">
                <span className="text-xs font-bold text-gray-200 truncate">
                  {isDownloaded && downloadedImageData.has(i) 
                    ? downloadedImageData.get(i)?.filename || result.title 
                    : result.title
                  }
                </span>
                <span className="text-[9px] text-gray-500 truncate">
                  {isDownloaded && downloadedImageData.has(i) 
                    ? `${downloadedImageData.get(i)?.type?.toUpperCase() || 'FILE'} • ${Math.round((downloadedImageData.get(i)?.size || 0) / 1024)}KB • ${downloadedImageData.get(i)?.filePath || ''}`
                    : result.description
                  }
                </span>
              </div>
              <div className={`text-[9px] font-medium px-2 py-1 rounded transition-colors ${
                isDownloaded 
                  ? 'bg-green-500/10 text-green-500' 
                  : isDownloading 
                  ? 'bg-yellow-500/10 text-yellow-500'
                  : 'bg-blue-500/10 text-blue-400'
              }`}>
                {isDownloaded ? 'Saved' : isDownloading ? 'Saving...' : `#${i + 1}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// SearchResultsView component for displaying search results in a dropdown
const SearchResultsView: React.FC<{ searchResults: SearchResult[], keyword?: string, pattern?: string }> = ({ searchResults, keyword, pattern }) => {
  const getSearchTerm = () => keyword || pattern || '';
  
  const handleFileClick = async (filename: string, _lineNumber?: number) => {
    try {
      await openFileInObsidian(filename);
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };
  
  return (
    <div className="p-4 space-y-3">
      <div className="pb-3 border-b border-gray-800 mb-3">
        <div className="text-sm font-medium text-gray-200 mb-1">
          Found {searchResults.length} file{searchResults.length !== 1 ? 's' : ''} for "{getSearchTerm()}"
        </div>
        <div className="text-xs text-gray-500">
          Click any result to open the file
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
        {searchResults.map((result, resultIndex) => (
          <div key={resultIndex} className="space-y-1">
            <div 
              className="flex items-center space-x-3 p-3 rounded-xl bg-gray-800/30 border border-gray-700/30 hover:bg-gray-700/20 transition-all group cursor-pointer"
              onClick={() => handleFileClick(result.filename)}
            >
              <div className="w-8 h-8 rounded-lg bg-gray-600/20 flex items-center justify-center shrink-0 border border-gray-600/20">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex flex-col truncate flex-1">
                <span className="text-xs font-bold text-gray-200 group-hover:text-blue-400 transition-colors truncate">
                  {result.filename}
                </span>
                <span className="text-[9px] text-gray-500 truncate font-mono">
                  {result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="text-[9px] font-medium px-2 py-1 rounded bg-blue-500/10 text-blue-400">
                #{resultIndex + 1}
              </div>
            </div>
            
            {/* Show first few matches as previews */}
            {result.matches.slice(0, 3).map((match: SearchMatch, matchIndex: number) => (
              <div 
                key={matchIndex}
                className="ml-8 flex items-start space-x-2 p-2 rounded-lg bg-gray-800/20 cursor-pointer hover:bg-gray-700/20 transition-all"
                onClick={() => handleFileClick(result.filename)}
              >
                <span className="text-[8px] text-gray-500 font-mono mt-0.5 shrink-0">
                  L{match.line}:
                </span>
                <span className="text-[9px] text-gray-500 font-mono truncate">
                  {match.content.substring(0, 120)}{match.content.length > 120 ? '...' : ''}
                </span>
              </div>
            ))}
            
            {result.matches.length > 3 && (
              <div className="ml-8 text-[8px] text-gray-500 italic">
                ... and {result.matches.length - 3} more match{result.matches.length - 3 !== 1 ? 'es' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
      {searchResults.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No results found for "{getSearchTerm()}"
        </div>
      )}
    </div>
  );
};

// Auto-generate action labels from tool declarations
const toolLabels = COMMAND_DECLARATIONS.reduce((acc, tool) => {
  if (tool?.name) {
    // Convert tool name to uppercase display label
    acc[tool.name] = tool.name.toUpperCase().replace(/_/g, '_');
  }
  return acc;
}, {} as Record<string, string>);

// Handle special cases and fallbacks
const specialCases: Record<string, string> = {
  'read_file': 'READ',
  'create_file': 'CREATE',
  'update_file': 'UPDATE',
  'edit_file': 'EDIT',
  'rename_file': 'RENAME',
  'move_file': 'MOVE',
  'list_directory': 'SCAN',
  'dirlist': 'DIRS',
  'get_folder_tree': 'TREE',
  'search_keyword': 'SEARCH',
  'search_regexp': 'GREP',
  'search_and_replace_regex_in_file': 'REPLACE',
  'search_and_replace_regex_global': 'GLOBAL',
  'internet_search': 'WEB',
  'end_conversation': 'END',
  'delete_file': 'DELETE',
  'image_search': 'IMAGE',
  'download_image': 'SAVE',
  'context': 'CONTEXT',
  'error': 'ERROR'
};

const getActionLabel = (name: string) => {
  return specialCases[name] || toolLabels[name] || 'ACTION';
};

// ContextDropdownView component for displaying context information
const ContextDropdownView: React.FC<{ contextInfo: any }> = ({ contextInfo }) => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  
  const sections = [
    { id: 'overview', label: '📍 Overview', icon: '📍' },
    { id: 'workspace', label: '🖥️ Workspace', icon: '🖥️' },
    { id: 'recent', label: '⏰ Recent Files', icon: '⏰' },
    { id: 'chat', label: '💬 Chat Activity', icon: '💬' },
    { id: 'directory', label: '📂 Directory', icon: '📂' },
    { id: 'tags', label: '🏷️ Tags', icon: '🏷️' },
    { id: 'vault', label: '📊 Vault Stats', icon: '📊' }
  ];

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-gray-800/20 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <span className="text-blue-400">📄</span>
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-gray-200">Current Note</div>
                <div className="text-[9px] text-gray-400 font-mono truncate">
                  {contextInfo.currentNote || 'No active note'}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-800/20 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <span className="text-green-400">📁</span>
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-gray-200">Current Folder</div>
                <div className="text-[9px] text-gray-400 font-mono truncate">
                  {contextInfo.currentFolder || '/'}
                </div>
              </div>
            </div>
          </div>
        );

      case 'workspace':
        return (
          <div className="space-y-3">
            <div className="p-3 bg-gray-800/20 rounded-lg">
              <div className="text-xs font-medium text-gray-200 mb-2">Open Files ({contextInfo.workspace?.totalOpenFiles || 0})</div>
              <div className="space-y-1">
                {contextInfo.workspace?.openedFiles?.slice(0, 8).map((file: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2 text-[9px] text-gray-400 font-mono truncate">
                    <span className="text-blue-400">📄</span>
                    <span>{file}</span>
                  </div>
                ))}
                {(contextInfo.workspace?.openedFiles?.length || 0) > 8 && (
                  <div className="text-[8px] text-gray-500 italic">
                    ... and {(contextInfo.workspace?.openedFiles?.length || 0) - 8} more files
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'recent':
        return (
          <div className="space-y-2">
            {contextInfo.recentFiles?.slice(0, 10).map((file: any, index: number) => (
              <div key={index} className="flex items-center space-x-3 p-2 bg-gray-800/20 rounded-lg hover:bg-gray-700/20 transition-colors">
                <div className="w-6 h-6 rounded bg-orange-500/10 flex items-center justify-center shrink-0">
                  <span className="text-orange-400 text-xs">📄</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-200 truncate">{file.name}</div>
                  <div className="text-[8px] text-gray-500">{file.modified} • {file.size}</div>
                </div>
              </div>
            ))}
            {(contextInfo.recentFiles?.length || 0) > 10 && (
              <div className="text-[8px] text-gray-500 italic text-center pt-2">
                ... and {(contextInfo.recentFiles?.length || 0) - 10} more recent files
              </div>
            )}
          </div>
        );

      case 'chat':
        return (
          <div className="space-y-3">
            <div className="p-3 bg-gray-800/20 rounded-lg">
              <div className="text-xs font-medium text-gray-200 mb-2">Recent Messages ({contextInfo.chatHistory?.totalMessages || 0})</div>
              <div className="space-y-2">
                {contextInfo.chatHistory?.messages?.slice(0, 5).map((msg: string, index: number) => (
                  <div key={index} className="text-[9px] text-gray-400 italic bg-gray-900/30 p-2 rounded">
                    "{msg.length > 80 ? msg.substring(0, 80) + '...' : msg}"
                  </div>
                ))}
                {(contextInfo.chatHistory?.messages?.length || 0) > 5 && (
                  <div className="text-[8px] text-gray-500 italic">
                    ... and {(contextInfo.chatHistory?.messages?.length || 0) - 5} more messages
                  </div>
                )}
              </div>
            </div>
            <div className="p-3 bg-gray-800/20 rounded-lg">
              <div className="text-xs font-medium text-gray-200">Archived Conversations</div>
              <div className="text-[9px] text-gray-400">{contextInfo.totalArchived || 0} conversations archived</div>
            </div>
          </div>
        );

      case 'directory':
        return (
          <div className="space-y-2">
            {contextInfo.directoryStructure?.slice(0, 20).map((folder: string, index: number) => (
              <div key={index} className="flex items-center space-x-2 text-[9px] text-gray-400 font-mono p-1 hover:bg-gray-700/20 rounded">
                <span className="text-yellow-400">📁</span>
                <span>{folder}</span>
              </div>
            ))}
            {(contextInfo.directoryStructure?.length || 0) > 20 && (
              <div className="text-[8px] text-gray-500 italic text-center pt-2">
                ... and {(contextInfo.directoryStructure?.length || 0) - 20} more folders
              </div>
            )}
          </div>
        );

      case 'tags':
        return (
          <div className="space-y-2">
            <div className="p-3 bg-gray-800/20 rounded-lg">
              <div className="text-xs font-medium text-gray-200 mb-2">Most Used Tags ({contextInfo.tags?.totalTags || 0})</div>
              <div className="flex flex-wrap gap-2">
                {contextInfo.tags?.mostUsed?.slice(0, 15).map((tagInfo: any, index: number) => (
                  <div key={index} className="inline-flex items-center space-x-1 bg-purple-500/10 px-2 py-1 rounded-full">
                    <span className="text-[8px] text-purple-400 font-medium">{tagInfo.tag}</span>
                    <span className="text-[7px] text-purple-500">({tagInfo.count})</span>
                  </div>
                ))}
              </div>
              {(contextInfo.tags?.mostUsed?.length || 0) > 15 && (
                <div className="text-[8px] text-gray-500 italic mt-2">
                  ... and {(contextInfo.tags?.mostUsed?.length || 0) - 15} more tags
                </div>
              )}
            </div>
          </div>
        );

      case 'vault':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="p-3 bg-gray-800/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-400">📄</span>
                    <span className="text-xs font-medium text-gray-200">Total Files</span>
                  </div>
                  <span className="text-xs font-bold text-blue-400">{contextInfo.vault?.totalFiles || 0}</span>
                </div>
              </div>
              <div className="p-3 bg-gray-800/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-green-400">📁</span>
                    <span className="text-xs font-medium text-gray-200">Total Folders</span>
                  </div>
                  <span className="text-xs font-bold text-green-400">{contextInfo.vault?.totalFolders || 0}</span>
                </div>
              </div>
              <div className="p-3 bg-gray-800/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-purple-400">💾</span>
                    <span className="text-xs font-medium text-gray-200">Total Size</span>
                  </div>
                  <span className="text-xs font-bold text-purple-400">{contextInfo.vault?.totalSize || '0 B'}</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-700 pb-3">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeSection === section.id
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-gray-800/20 text-gray-400 hover:bg-gray-700/20 border border-gray-700/30'
            }`}
          >
            {section.icon} {section.label}
          </button>
        ))}
      </div>

      {/* Section Content */}
      <div className="min-h-[200px] max-h-[350px] overflow-y-auto">
        {renderSectionContent()}
      </div>
    </div>
  );
};

// Import WebSearchView from ToolResult
const WebSearchView: React.FC<{ content: string; chunks: GroundingChunk[] }> = ({ content, chunks }) => {
  return (
    <div className="p-4 space-y-4">
      <div className="pb-4 border-b border-gray-800 mb-4">
        <MarkdownRenderer content={content} />
      </div>
      {chunks.length > 0 && (
        <div className="space-y-3">
          <div className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-400/70 ml-1">Source Grounding</div>
          <div className="grid grid-cols-1 gap-2">
            {chunks.slice(0, 10).map((chunk, i) => {
              const item = chunk.web || chunk.maps;
              if (!item) return null;
              return (
                <a 
                  key={i} 
                  href={item.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-3 p-3 rounded-xl bg-gray-800/30 border border-gray-700/30 hover:bg-gray-700/20 transition-all group shadow-sm"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-600/20 flex items-center justify-center shrink-0 border border-gray-600/20">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-[11px] font-bold text-gray-200 group-hover:text-blue-400 transition-colors truncate">{item.title}</span>
                    <span className="text-[9px] text-gray-500 truncate font-mono">{new URL(item.uri).hostname}</span>
                  </div>
                </a>
              );
            })}
            {chunks.length > 10 && (
              <div className="text-gray-500 italic text-[9px] pt-2 px-3 border-t border-gray-700">
                ... and {chunks.length - 10} more sources (truncated)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface SystemMessageProps {
  children: React.ReactNode;
  toolData?: ToolData;
  isLast?: boolean;
  className?: string;
  onImageDownload?: (image: ImageSearchResult, index: number) => Promise<DownloadedImage | undefined> | void;
}

const SystemMessage: React.FC<SystemMessageProps> = ({ children, toolData, isLast, className = '', onImageDownload }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [manuallyToggled, setManuallyToggled] = useState(false);

  const isPending = toolData?.status === 'pending';
  const isError = toolData?.status === 'error';
  const hasExpandableContent = toolData && toolData.dropdown !== false && (toolData.newContent || toolData.oldContent || toolData.files || toolData.error || toolData.directoryInfo || toolData.searchResults);

  useEffect(() => {
    if (isLast && !manuallyToggled && !isPending && hasExpandableContent) {
      setIsExpanded(true);
    } else if (!isLast && !manuallyToggled) {
      setIsExpanded(false);
    }
  }, [isLast, manuallyToggled, isPending, hasExpandableContent]);

  const toggle = () => {
    if (isPending || !hasExpandableContent) return;
    setIsExpanded(!isExpanded);
    setManuallyToggled(true);
  };

  const extractSearchInfo = (chunks: GroundingChunk[]) => {
    if (!chunks || chunks.length === 0) return '';
    
    // Extract keywords from titles and domains
    const keywords = new Set<string>();
    const domains = new Set<string>();
    
    chunks.forEach(chunk => {
      const item = chunk.web || chunk.maps;
      if (item) {
        // Extract keywords from title
        if (item.title) {
          const words = item.title.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !['the', 'and', 'for', 'are', 'with', 'this', 'that', 'from', 'they', 'have', 'been', 'has', 'had', 'was', 'were', 'will', 'would', 'could', 'should'].includes(word));
          words.forEach(word => keywords.add(word));
        }
        
        // Extract domain
        try {
          const domain = new URL(item.uri).hostname;
          domains.add(domain);
        } catch {
          // Invalid URL, skip
        }
      }
    });
    
    const keywordList = Array.from(keywords).slice(0, 3).join(', ');
    const domainList = Array.from(domains).slice(0, 2).join(', ');
    
    if (keywordList && domainList) {
      return ` (${keywordList} | ${domainList})`;
    } else if (keywordList) {
      return ` (${keywordList})`;
    } else if (domainList) {
      return ` (${domainList})`;
    }
    
    return '';
  };

  // Dynamic styling based on status
  const getStyles = () => {
    if (isError) {
      return {
        backgroundColor: 'transparent',
        border: 'none',
        headerBg: 'transparent',
        contentBg: 'rgba(239, 68, 68, 0.05)',
        borderColor: 'rgba(239, 68, 68, 0.1)',
        accentColor: '#ef4444',
        textColor: '#ef4444',
        mutedColor: '#fca5a5'
      };
    }
    
    // Default/pending/success state - transparent with minimal styling
    return {
      backgroundColor: 'transparent',
      border: 'none',
      headerBg: 'transparent',
      contentBg: 'rgba(156, 163, 175, 0.03)',
      borderColor: 'rgba(156, 163, 175, 0.08)',
      accentColor: '#9ca3af',
      textColor: '#9ca3af',
      mutedColor: '#e5e7eb'
    };
  };

  const styles = getStyles();

  return (
    <div 
      className={`w-full max-w-2xl rounded-xl overflow-hidden transition-all ${className}`}
      style={{ 
        backgroundColor: styles.backgroundColor,
        border: styles.border
      }}
    >
      <div 
        onClick={toggle}
        className={`flex items-center justify-between px-2 py-1.5 ${hasExpandableContent && !isPending ? 'cursor-pointer' : 'cursor-default'} transition-colors`}
        style={{ 
          backgroundColor: styles.headerBg
        }}
      >
        <div className="flex items-center space-x-2 overflow-hidden">
          {isPending && (
            <div className="flex items-center space-x-1 shrink-0">
              {toolData?.name === 'internet_search' ? (
                <div className="loading-dots-container">
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                </div>
              ) : (
                <span style={{ color: styles.accentColor }}>...</span>
              )}
            </div>
          )}
          
          {toolData && (
            <span 
              className="text-[9px] font-black px-1 py-0.5 rounded shrink-0"
              style={{ 
                backgroundColor: 'transparent',
                color: styles.accentColor
              }}
            >
              {getActionLabel(toolData.name)}
              {toolData?.name === 'internet_search' && toolData?.groundingChunks && 
                extractSearchInfo(toolData.groundingChunks)
              }
            </span>
          )}
          
          {toolData?.displayFormat ? (
            <span 
              className="text-[11px] font-mono truncate max-w-[400px]"
              dangerouslySetInnerHTML={{ __html: toolData.displayFormat }}
            />
          ) : (
            <span 
              className="text-[11px] font-mono truncate max-w-[400px]"
              style={{ color: styles.textColor }}
            >
              {toolData?.name === 'internet_search' && toolData?.filename ? 
                `Searching: ${toolData.filename}` : 
                toolData?.name === 'search_keyword' && toolData?.searchKeyword ? 
                `Searching for "${toolData.searchKeyword}"` :
                toolData?.name === 'search_regexp' && toolData?.filename ? 
                `Regex: ${toolData.filename}` :
                (toolData?.filename || children)
              }
            </span>
          )}
          
          {isError && (
            <span className="text-[8px] px-1 py-0.5 rounded font-bold" style={{
              backgroundColor: 'transparent',
              color: '#ef4444'
            }}>
              ERROR
            </span>
          )}
          
        </div>
        
        <div className="flex items-center space-x-4 shrink-0">
          {!isPending && hasExpandableContent ? (
            <svg 
              className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
              style={{ color: styles.accentColor }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : null}
        </div>
      </div>

      {isExpanded && !isPending && hasExpandableContent && (
        <>
          {/* Performance Information - Above scrollable content */}
          {toolData?.name === 'internet_search' && (toolData.duration !== undefined || toolData.responseLength !== undefined) && (
            <div 
              className="flex items-center justify-between px-4 py-2"
              style={{ 
                backgroundColor: styles.contentBg,
                borderTop: styles.borderColor
              }}
            >
              <div className="flex items-center space-x-4 text-[9px]" style={{ color: styles.mutedColor }}>
                {toolData.duration !== undefined && (
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{toolData.duration}ms</span>
                  </div>
                )}
                {toolData.responseLength !== undefined && (
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>{toolData.responseLength.toLocaleString()} chars</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div 
            className="max-h-[400px] overflow-y-auto custom-scrollbar"
            style={{ 
              backgroundColor: styles.contentBg,
              borderTop: toolData?.name === 'internet_search' && (toolData.duration !== undefined || toolData.responseLength !== undefined) ? 'none' : styles.borderColor
            }}
          >
          {/* Directory listing - render content directly without nesting ToolResult */}
          {toolData?.name === 'list_directory' && toolData?.files ? (
            <div className="p-4 font-mono text-[10px]">
              <div className="flex items-center justify-between mb-3">
                <span className="hermes-text-muted">
                  {toolData.truncated ? 
                    `${toolData.shownItems} of ${toolData.totalItems} items (Page ${toolData.currentPage} of ${toolData.totalPages})` : 
                    `${toolData.files.length} items found`
                  }
                </span>
                {toolData.truncated && (
                  <span className="hermes-text-accent font-bold text-[9px] px-2 py-1 hermes-interactive-bg/20 rounded">
                    TRUNCATED
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {toolData.files.map((file: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2 hermes-text-normal hover:hermes-bg-secondary/5 px-2 py-0.5 rounded transition-colors">
                    <span className="hermes-text-muted">{'📄'}</span>
                    <span className="truncate">{file}</span>
                  </div>
                ))}
              </div>
              {toolData.truncated && (
                <div className="mt-3 pt-3 hermes-border-t hermes-text-muted italic text-[9px] text-center">
                  ... and {toolData.totalItems - toolData.shownItems} more items (use pagination for more)
                </div>
              )}
            </div>
          ) : toolData?.name === 'dirlist' && toolData?.directoryInfo ? (
            <div className="p-4 font-mono text-[10px]">
              <div className="flex items-center justify-between mb-3">
                <span className="hermes-text-muted">
                  {toolData.truncated ? 
                    `${toolData.shownItems} of ${toolData.totalItems} directories (Page ${toolData.currentPage} of ${toolData.totalPages})` : 
                    `${toolData.directoryInfo.length} directories found`
                  }
                </span>
                {toolData.truncated && (
                  <span className="hermes-text-accent font-bold text-[9px] px-2 py-1 hermes-interactive-bg/20 rounded">
                    TRUNCATED
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {toolData.directoryInfo.map((dir: DirectoryInfoItem, index: number) => (
                  <div key={index} className="flex items-center space-x-2 hermes-text-normal hover:hermes-bg-secondary/5 px-2 py-0.5 rounded transition-colors">
                    <span className="hermes-text-muted">
                      {dir.hasChildren ? '📁' : '📂'}
                    </span>
                    <span className="truncate">{dir.path || '/'}</span>
                    {dir.hasChildren && (
                      <span className="hermes-text-muted text-[8px] px-1 py-0.5 hermes-bg-secondary/10 rounded">
                        has subdirs
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {toolData.truncated && (
                <div className="mt-3 pt-3 hermes-border-t hermes-text-muted italic text-[9px] text-center">
                  ... and {toolData.totalItems - toolData.shownItems} more directories (use search for specific paths)
                </div>
              )}
            </div>
          ) : toolData?.name === 'get_folder_tree' && toolData?.files ? (
            <div className="p-4 font-mono text-[10px]">
              <div className="flex items-center justify-between mb-3">
                <span className="hermes-text-muted">
                  {toolData.truncated ? 
                    `${toolData.shownItems} of ${toolData.totalItems} folders (Page ${toolData.currentPage} of ${toolData.totalPages})` : 
                    `${toolData.files.length} folders found`
                  }
                </span>
                {toolData.truncated && (
                  <span className="hermes-text-accent font-bold text-[9px] px-2 py-1 hermes-interactive-bg/20 rounded">
                    TRUNCATED
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {toolData.files.map((folder: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2 hermes-text-normal hover:hermes-bg-secondary/5 px-2 py-0.5 rounded transition-colors">
                    <span className="hermes-text-muted">{'📁'}</span>
                    <span className="truncate">{folder}</span>
                  </div>
                ))}
              </div>
              {toolData.truncated && (
                <div className="mt-3 pt-3 hermes-border-t hermes-text-muted italic text-[9px] text-center">
                  ... and {toolData.totalItems - toolData.shownItems} more folders
                </div>
              )}
            </div>
          ) : toolData?.name === 'image_search' && toolData?.status === 'search_results' && toolData?.searchResults ? (
            <ImageSearchResultsView 
              searchResults={toolData.searchResults} 
              query={toolData.filename}
              totalFound={toolData.totalFound || 0}
              onImageDownload={onImageDownload}
            />
          ) : toolData?.name === 'context' && toolData?.contextInfo ? (
            <ContextDropdownView contextInfo={toolData.contextInfo} />
          ) : toolData?.name === 'internet_search' ? (
            <div className="p-2">
              <WebSearchView content={toolData.newContent || ''} chunks={toolData.groundingChunks || []} />
            </div>
          ) : (toolData?.name === 'search_keyword' || toolData?.name === 'search_regexp') && toolData?.searchResults ? (
            <SearchResultsView 
              searchResults={toolData.searchResults} 
              keyword={toolData.searchKeyword}
              pattern={toolData.filename}
            />
          ) : (
            <>
              {toolData?.newContent && (
                <div className="p-2 font-mono text-[10px] whitespace-pre-wrap" style={{ color: styles.textColor }}>
                  {toolData.newContent}
                </div>
              )}
              
              {toolData?.files && (
                <div className="p-2 font-mono text-[10px]">
                  <div className="space-y-1">
                    {toolData.files.map((file: string, index: number) => (
                      <div key={index} className="flex items-center space-x-2 px-1 py-0.5 rounded" style={{ color: styles.textColor }}>
                        <span>📄</span>
                        <span className="truncate">{file}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {toolData?.error && (
                <div className="p-2 font-mono text-[10px] italic" style={{ color: '#fca5a5' }}>
                  Error: {toolData.error}
                </div>
              )}
            </>
          )}
        </div>
        </>
      )}
    </div>
  );
};

export default SystemMessage;
