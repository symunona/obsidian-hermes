import React, { useState, useEffect } from 'react';
import { ToolData } from '../../types';
import ToolResult from '../ToolResult';
import MarkdownRenderer from '../MarkdownRenderer';
import { COMMAND_DECLARATIONS } from '../../services/commands';

// ImageSearchResultsView component for interactive image preview
const ImageSearchResultsView: React.FC<{ 
  searchResults: any[], 
  query: string, 
  totalFound: number, 
  onImageDownload?: (image: any, index: number) => void 
}> = ({ searchResults, query, totalFound, onImageDownload }) => {
  const [downloadingImages, setDownloadingImages] = useState<Set<number>>(new Set());
  const [downloadedImages, setDownloadedImages] = useState<Set<number>>(new Set());
  const [downloadedImageData, setDownloadedImageData] = useState<Map<number, any>>(new Map());

  const handleImageClick = async (result: any, index: number) => {
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
                  } ${isDownloading ? 'opacity-50' : ''}`}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <svg className={`w-6 h-6 text-blue-400 hidden`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                {isDownloaded ? 'SAVED' : isDownloading ? 'SAVING...' : `#${i + 1}`}
              </div>
            </div>
          );
        })}
      </div>
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
  'error': 'ERROR'
};

const getActionLabel = (name: string) => {
  return specialCases[name] || toolLabels[name] || 'ACTION';
};

// Import WebSearchView from ToolResult
const WebSearchView: React.FC<{ content: string, chunks: any[] }> = ({ content, chunks }) => {
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
  onImageDownload?: (image: any, index: number) => void;
}

const SystemMessage: React.FC<SystemMessageProps> = ({ children, toolData, isLast, className = '', onImageDownload }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [manuallyToggled, setManuallyToggled] = useState(false);

  const isPending = toolData?.status === 'pending';
  const isError = toolData?.status === 'error';
  const isSuccess = toolData?.status === 'success';
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

  const extractSearchInfo = (chunks: any[]) => {
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
        } catch (e) {
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
        <div 
          className="max-h-[400px] overflow-y-auto custom-scrollbar"
          style={{ 
            backgroundColor: styles.contentBg,
            borderTop: styles.borderColor
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
                {toolData.directoryInfo.map((dir: any, index: number) => (
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
          ) : toolData?.name === 'internet_search' ? (
            <div className="p-2">
              <WebSearchView content={toolData.newContent || ''} chunks={toolData.groundingChunks || []} />
            </div>
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
      )}
    </div>
  );
};

export default SystemMessage;
