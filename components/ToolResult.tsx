
import React, { useState, useMemo, useEffect } from 'react';
import { ToolData, FileDiff } from '../types';

interface ToolResultProps {
  toolData: ToolData;
  isLast: boolean;
}

const DiffView: React.FC<{ diff: FileDiff }> = ({ diff }) => {
  const diffLines = useMemo(() => {
    if (!diff.oldContent && !diff.newContent) return null;
    const oldLines = (diff.oldContent || '').split('\n');
    const newLines = (diff.newContent || '').split('\n');
    const max = Math.max(oldLines.length, newLines.length);
    
    return Array.from({ length: max }).map((_, i) => {
      const o = oldLines[i];
      const n = newLines[i];
      return { old: o, new: n, index: i + 1 };
    });
  }, [diff]);

  if (!diffLines) return null;

  return (
    <div className="bg-[#0d1117] p-2 overflow-x-auto font-mono text-[9px] leading-4 border-b border-white/5 last:border-0">
      <div className="text-indigo-400 font-bold mb-1 px-1">{diff.filename}</div>
      <div className="grid grid-cols-[20px_1fr_20px_1fr] gap-x-1">
        {diffLines.map((line, i) => (
          <React.Fragment key={i}>
            <div className="text-slate-700 text-right pr-1 select-none opacity-40">{line.old !== undefined ? line.index : ''}</div>
            <div className={`whitespace-pre-wrap ${line.old !== line.new && line.old !== undefined ? 'bg-red-900/20 text-red-300' : 'text-slate-600'}`}>
              {line.old !== undefined ? (line.old || ' ') : ''}
            </div>
            <div className="text-slate-700 text-right pr-1 select-none opacity-40">{line.new !== undefined ? line.index : ''}</div>
            <div className={`whitespace-pre-wrap ${line.old !== line.new && line.new !== undefined ? 'bg-emerald-900/20 text-emerald-300' : 'text-slate-400'}`}>
              {line.new !== undefined ? (line.new || ' ') : ''}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const ToolResult: React.FC<ToolResultProps> = ({ toolData, isLast }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [manuallyToggled, setManuallyToggled] = useState(false);

  useEffect(() => {
    if (isLast && !manuallyToggled) {
      setIsExpanded(true);
    } else if (!isLast && !manuallyToggled) {
      setIsExpanded(false);
    }
  }, [isLast, manuallyToggled]);

  const toggle = () => {
    setIsExpanded(!isExpanded);
    setManuallyToggled(true);
  };

  const getActionLabel = (name: string) => {
    switch(name) {
      case 'read_file': return 'READ';
      case 'create_file': return 'CREATE';
      case 'update_file': return 'UPDATE';
      case 'edit_file': return 'EDIT';
      case 'list_directory': return 'SCAN';
      case 'search_keyword': return 'SEARCH';
      case 'search_regexp': return 'GREP';
      case 'search_and_replace_regex_in_file': return 'REPLACE';
      case 'search_and_replace_regex_global': return 'GLOBAL';
      default: return 'ACTION';
    }
  };

  return (
    <div className="w-full my-2 border border-white/5 rounded-xl overflow-hidden bg-slate-900/40">
      <div 
        onClick={toggle}
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center space-x-3">
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
            toolData.name.includes('create') ? 'bg-emerald-500/20 text-emerald-400' : 
            toolData.name.includes('read') ? 'bg-indigo-500/20 text-indigo-400' :
            toolData.name.includes('search') ? 'bg-purple-500/20 text-purple-400' :
            toolData.name.includes('replace') ? 'bg-amber-500/20 text-amber-400' :
            'bg-slate-500/20 text-slate-400'
          }`}>
            {getActionLabel(toolData.name)}
          </span>
          <span className="text-[11px] font-mono text-slate-300 truncate max-w-[200px]">
            {toolData.filename}
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-[10px] font-mono">
            {toolData.files && (
              <span className="text-slate-500">{toolData.files.length} items</span>
            )}
            {toolData.searchResults && (
              <span className="text-purple-400">{toolData.searchResults.length} files matched</span>
            )}
            {toolData.multiDiffs && (
              <span className="text-amber-400">{toolData.multiDiffs.length} files updated</span>
            )}
            {toolData.additions !== undefined && toolData.additions > 0 && (
              <span className="text-emerald-500">+{toolData.additions}</span>
            )}
            {toolData.removals !== undefined && toolData.removals > 0 && (
              <span className="text-red-500">-{toolData.removals}</span>
            )}
          </div>
          <svg 
            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-white/5 bg-[#0d1117] max-h-[500px] overflow-y-auto">
          {/* List Directory View */}
          {toolData.name === 'list_directory' && toolData.files && (
            <div className="p-4 font-mono text-[10px] space-y-1">
              {toolData.files.map((file, idx) => (
                <div key={file} className="flex items-center space-x-3 text-slate-400 py-1">
                  <span className="text-slate-700 w-4">{idx + 1}.</span>
                  <span>{file}</span>
                </div>
              ))}
            </div>
          )}

          {/* Search Results View */}
          {(toolData.name === 'search_keyword' || toolData.name === 'search_regexp') && toolData.searchResults && (
            <div className="p-4 space-y-4">
              {toolData.searchResults.length === 0 ? (
                <div className="text-slate-600 italic text-[10px]">No matches found.</div>
              ) : (
                toolData.searchResults.map((res, i) => (
                  <div key={i} className="space-y-1">
                    <div className="text-[10px] font-bold text-indigo-400 font-mono">{res.filename}</div>
                    <div className="pl-3 border-l border-white/10 space-y-1">
                      {res.matches.map((m, j) => (
                        <div key={j} className="text-[9px] font-mono flex space-x-2">
                          <span className="text-slate-700 shrink-0 w-6 text-right">{m.line}</span>
                          <span className="text-slate-400 truncate">{m.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Multi-Diff View (Global Replace) */}
          {toolData.name === 'search_and_replace_regex_global' && toolData.multiDiffs && (
            <div className="divide-y divide-white/5">
              {toolData.multiDiffs.length === 0 ? (
                <div className="p-4 text-slate-600 italic text-[10px]">No files modified.</div>
              ) : (
                toolData.multiDiffs.map((diff, i) => (
                  <DiffView key={i} diff={diff} />
                ))
              )}
            </div>
          )}

          {/* Singular Diff View */}
          {(!toolData.multiDiffs && toolData.newContent !== undefined) && (
            <DiffView diff={{ filename: toolData.filename, oldContent: toolData.oldContent, newContent: toolData.newContent }} />
          )}

          {toolData.error && (
            <div className="p-4 border-t border-red-500/20 bg-red-500/5 text-red-400 text-[11px] font-mono">
              Error: {toolData.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolResult;
