import React, { useState, useEffect } from 'react';
import { ArchivedConversation, TranscriptionEntry } from '../types';
import { loadArchivedConversations, deleteArchivedConversation } from '../persistence/persistence';

interface HistoryProps {
  isActive: boolean;
  onRestoreConversation?: (conversation: TranscriptionEntry[]) => void;
}

interface HistoryTileProps {
  conversation: ArchivedConversation;
  onRestore?: (conversation: TranscriptionEntry[]) => void;
  onDelete?: (key: string) => void;
}

const HistoryTile: React.FC<HistoryTileProps> = ({ conversation, onRestore, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Calculate metadata
  const messageCount = conversation.conversation.filter(entry => 
    entry.role === 'user' || entry.role === 'model'
  ).length;
  
  const timestamps = conversation.conversation
    .map(entry => entry.timestamp)
    .filter(ts => ts > 0);
  
  const duration = timestamps.length > 1 
    ? Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 1000)
    : 0;
  
  const startDate = new Date(conversation.archivedAt);
  const formattedDate = startDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  
  const formattedTime = startDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };
  
  const handleRestore = () => {
    if (onRestore) {
      onRestore(conversation.conversation);
    }
  };
  
  const handleDelete = () => {
    // TODO: Shop dialog, that's not a confirm.
    onDelete(conversation.key);
  };
  
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden hermes-bg-secondary-alt shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 transition-all duration-200">
      {/* Header - Clickable to expand/collapse */}
      <div
        className="p-4 cursor-pointer hermes-hover:bg-secondary/10 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-semibold hermes-text-normal mb-1">
              {conversation.title || conversation.summary.split('\n')[0]}
            </div>
            {conversation.tags && conversation.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1">
                {conversation.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="text-xs px-1.5 py-0.5 rounded hermes-bg-secondary hermes-text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 text-xs hermes-text-faint">
              <span>{formattedDate} at {formattedTime}</span>
              <span>•</span>
              <span>{messageCount} messages</span>
              <span>•</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-2 border border-red-600/30 text-red-600/60 rounded-md hover:border-red-600/50 hover:text-red-600/80 transition-colors flex items-center gap-1"
              title="Delete conversation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            
            {/* Restore Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRestore();
              }}
              className="p-2 hermes-bg-primary text-white rounded-md hermes-hover:bg-primary/80 transition-colors flex items-center gap-1"
              title="Restore conversation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm">Restore</span>
            </button>
            
            {/* Chevron */}
            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5 hermes-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700">
          <div className="pt-4">
            <h4 className="text-sm font-medium hermes-text-normal mb-2">Summary</h4>
            <div className="text-sm hermes-text-muted whitespace-pre-wrap">
              {conversation.summary}
            </div>
          </div>
          
          <div className="mt-4">
            <h4 className="text-sm font-medium hermes-text-normal mb-2">Metadata</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="hermes-text-faint">Date:</span>
                <span className="ml-2 hermes-text-muted">{formattedDate}</span>
              </div>
              <div>
                <span className="hermes-text-faint">Time:</span>
                <span className="ml-2 hermes-text-muted">{formattedTime}</span>
              </div>
              <div>
                <span className="hermes-text-faint">Messages:</span>
                <span className="ml-2 hermes-text-muted">{messageCount}</span>
              </div>
              <div>
                <span className="hermes-text-faint">Duration:</span>
                <span className="ml-2 hermes-text-muted">{formatDuration(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const History: React.FC<HistoryProps> = ({ isActive, onRestoreConversation }) => {
  const [conversations, setConversations] = useState<ArchivedConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(async () => {
    const loadHistory = async () => {
      try {
        setIsLoading(true);
        const archived = await loadArchivedConversations();
        setConversations(archived.sort((a, b) => b.archivedAt - a.archivedAt));
      } catch (error) {
        console.error('Failed to load history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isActive) {
      await loadHistory();
    }
  }, [isActive]);

  const filteredConversations = conversations.filter(conv => {
    const query = searchQuery.toLowerCase();
    const titleMatch = conv.title?.toLowerCase().includes(query);
    const summaryMatch = conv.summary?.toLowerCase().includes(query);
    const tagMatch = conv.tags?.some(tag => tag.toLowerCase().includes(query));
    return titleMatch || summaryMatch || tagMatch;
  });

  const handleDeleteConversation = async (key: string) => {
    try {
      await deleteArchivedConversation(key);
      setConversations(prev => prev.filter(conv => conv.key !== key));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  if (!isActive) return null;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 hermes-border-b">
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 hermes-bg-tertiary border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hermes-text-normal placeholder-hermes-text-faint"
          />

        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="hermes-text-muted">Loading history...</div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-8">
            <div className="hermes-text-muted">
              {searchQuery ? 'No conversations found matching your search.' : 'No archived conversations yet.'}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map((conv) => (
              <HistoryTile
                key={conv.key}
                conversation={conv}
                onRestore={onRestoreConversation}
                onDelete={handleDeleteConversation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
