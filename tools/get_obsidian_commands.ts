import { Type } from '@google/genai';
import { getObsidianApp } from '../utils/environment';
import type { ToolCallbacks } from '../types';
import { getErrorMessage } from '../utils/getErrorMessage';

type ToolArgs = Record<string, unknown>;

const getStringArg = (args: ToolArgs, key: string): string | undefined => {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
};

export const declaration = {
  name: 'get_obsidian_commands',
  description: 'Lists all available Obsidian commands that can be executed.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      filter: { 
        type: Type.STRING, 
        description: 'Optional text filter to search for specific commands by name or description.' 
      }
    }
  }
};

export const instruction = `- get_obsidian_commands: Use this to list all available Obsidian commands. You can optionally filter commands by name or description.`;

export const execute = (args: ToolArgs, callbacks: ToolCallbacks): Promise<unknown> => {
  const filter = getStringArg(args, 'filter');
  
  try {
    const app = getObsidianApp();
    
    if (!app) {
      throw new Error('Not running in Obsidian environment');
    }

    const commands = app.commands.commands as Record<string, { name: string; editor?: { name?: string } }>;
    const commandList = Object.entries(commands).map(([id, command]) => ({
      id,
      name: command.name,
      description: command.editor?.name || command.name
    }));

    // Apply filter if provided
    let filteredCommands = commandList;
    if (filter) {
      const filterLower = filter.toLowerCase();
      filteredCommands = commandList.filter(cmd => 
        cmd.name.toLowerCase().includes(filterLower) ||
        cmd.description.toLowerCase().includes(filterLower) ||
        cmd.id.toLowerCase().includes(filterLower)
      );
    }

    // Sort commands by name
    filteredCommands.sort((a, b) => a.name.localeCompare(b.name));

    const commandNames = filteredCommands.map(cmd => `${cmd.name} (${cmd.id})`);
    
    callbacks.onSystem(`Obsidian commands (${filteredCommands.length} total)`, {
      name: 'get_obsidian_commands',
      filename: 'Command Registry',
      files: commandNames
    });

    return Promise.resolve({
      commands: filteredCommands,
      total: commandList.length,
      filtered: filteredCommands.length,
      filter: filter || null
    });
  } catch (error) {
    console.error('Get Obsidian commands error:', error);
    throw new Error(`Failed to get Obsidian commands: ${getErrorMessage(error)}`);
  }
};
