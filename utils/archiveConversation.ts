import { TranscriptionEntry, ToolData } from '../types';

export const archiveConversation = async (summary: string, history: TranscriptionEntry[]) => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
  const safeTopic = summary.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 40);
  const filename = `chat-history/chat-history-${timestamp}-${safeTopic}.md`;

  const filteredHistory = history.filter(t => {
    if (t.id === 'welcome-init') return false;
    if (t.role === 'model' && t.text.trim().toLowerCase().replace(/\./g, '') === 'done') return false;
    return true;
  });

  // Calculate duration from first to last entry
  const timestamps = filteredHistory.map(t => t.timestamp).filter(t => t > 0);
  const startDate = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : now.toISOString();
  const endDate = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : now.toISOString();
  const duration = timestamps.length > 1 ? Math.round((timestamps[timestamps.length - 1] - timestamps[0]) / 1000) : 0;
  
  // Auto-generate tags from content
  const allText = filteredHistory.map(t => t.text.toLowerCase()).join(' ');
  const tags = new Set<string>();
  
  // Auto-tag common topics
  if (allText.includes('file') || allText.includes('edit') || allText.includes('create')) tags.add('file-management');
  if (allText.includes('search') || allText.includes('find') || allText.includes('look')) tags.add('search');
  if (allText.includes('image') || allText.includes('generate') || allText.includes('create')) tags.add('creation');
  if (allText.includes('rename') || allText.includes('move') || allText.includes('organize')) tags.add('organization');
  if (allText.includes('help') || allText.includes('how') || allText.includes('question')) tags.add('help');
  
  // Add duration-based tags
  if (duration > 300) tags.add('long-conversation');
  if (duration < 60) tags.add('quick-chat');
  
  const tagString = Array.from(tags).join(', ');

  // Group consecutive entries by role to merge multi-line messages
  const groupedEntries: TranscriptionEntry[][] = [];
  let currentGroup: TranscriptionEntry[] = [];
  let currentRole: string | null = null;
  
  filteredHistory.forEach(entry => {
    if (currentRole === null || entry.role !== currentRole) {
      if (currentGroup.length > 0) {
        groupedEntries.push(currentGroup);
      }
      currentGroup = [entry];
      currentRole = entry.role;
    } else {
      currentGroup.push(entry);
    }
  });
  
  if (currentGroup.length > 0) {
    groupedEntries.push(currentGroup);
  }

  const markdown = groupedEntries
    .map((group, groupIndex) => {
      const firstEntry = group[0];
      let block = '';
      
      // Merge text from all entries in the group
      const mergedText = group.map(e => e.text).join(' ').trim();
      
      if (firstEntry.role === 'user') {
        // No "User:" prefix, just the text
        block = mergedText;
      } else if (firstEntry.role === 'model') {
        block = `> ${mergedText.split('\n').join('\n> ')}`;
      } else if (firstEntry.role === 'system') {
        // Handle all system messages in the group
        const systemBlocks = group.map(entry => {
          if (entry.toolData?.name === 'rename_file') {
            return `**RENAME** ~~${entry.toolData.oldContent}~~ -> [[${entry.toolData.newContent}]]`;
          } else if (entry.toolData?.name === 'topic_switch') {
            return `## ${entry.toolData.newContent}`;
          } else {
            let output = `\`\`\`system\n${entry.text}\n\`\`\``;
            if (entry.toolData) {
              const fileRef = `[[${entry.toolData.filename}]]`;
              if (entry.toolData.oldContent !== undefined && entry.toolData.newContent !== undefined && entry.toolData.oldContent !== entry.toolData.newContent) {
                // Check if content was actually removed (old content has content that's not in new content)
                const hasRemovedContent = entry.toolData.oldContent && 
                  entry.toolData.oldContent.trim() !== '' && 
                  !entry.toolData.newContent.includes(entry.toolData.oldContent);
                
                if (hasRemovedContent) {
                  output += `\n\n${fileRef}\n\n--- Removed\n\`\`\`markdown\n${entry.toolData.oldContent || '(empty)'}\n\`\`\`\n\n+++ Added\n\`\`\`markdown\n${entry.toolData.newContent || '(empty)'}\n\`\`\``;
                } else {
                  // Only show addition/modification, no removal
                  output += `\n\n${fileRef}\n\`\`\`markdown\n${entry.toolData.newContent}\n\`\`\``;
                }
              } else if (entry.toolData.name === 'read_file' || entry.toolData.name === 'create_file') {
                 output += `\n\n${fileRef}\n\`\`\`markdown\n${entry.toolData.newContent}\n\`\`\``;
              }
            }
            return output;
          }
        });
        
        block = systemBlocks.join('\n\n');
      }
      
      return block;
    })
    .filter(block => block.trim() !== '')
    .join('\n\n');

  try {
    const { createFile, createDirectory } = await import('../services/mockFiles');
    
    // Ensure the chat-history directory exists
    try {
      await createDirectory('chat-history');
    } catch (err: any) {
      // Directory might already exist, that's fine
      if (!err.message.includes('already exists')) {
        throw err;
      }
    }
    
    const frontmatter = `---
title: ${summary}
date: ${startDate}
end_date: ${endDate}
duration: ${duration}
tags: [${tagString}]
format: hermes-chat-archive
---

`;
    
    await createFile(filename, `${frontmatter}${markdown}`);
    return `Segment archived to ${filename}`;
  } catch (err: any) {
    throw new Error(`Persistence Failure: ${err.message}`);
  }
};
