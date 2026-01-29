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
  name: 'run_obsidian_command',
  description: 'Executes an Obsidian command by its command ID.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      commandId: { 
        type: Type.STRING, 
        description: 'The command ID to execute (e.g., "editor:toggle-bold" or "workspace:open-command-palette").' 
      }
    },
    required: ['commandId']
  }
};

export const instruction = `- run_obsidian_command: Use this to execute an Obsidian command by its command ID. Use get_obsidian_commands first to find available commands and their IDs.`;

export const execute = async (args: ToolArgs, callbacks: ToolCallbacks): Promise<unknown> => {
  const commandId = getStringArg(args, 'commandId');
  if (!commandId) {
    throw new Error('Missing commandId');
  }
  
  try {
    const app = getObsidianApp();
    
    if (!app) {
      throw new Error('Not running in Obsidian environment');
    }

    // Check if command exists
    const command = app.commands.commands[commandId];
    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }

    // Execute the command
    await app.commands.executeCommandById(commandId);

    const commandName = command.name || commandId;
    
    callbacks.onSystem(`Executed: ${commandName}`, {
      name: 'run_obsidian_command',
      filename: 'Command Execution',
      status: 'success'
    });

    return {
      success: true,
      commandId,
      commandName,
      executedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Run Obsidian command error:', error);
    const errorMessage = getErrorMessage(error);
    callbacks.onSystem(`Command execution failed: ${errorMessage}`, {
      name: 'run_obsidian_command',
      filename: 'Command Execution',
      status: 'error',
      error: errorMessage
    });
    
    throw new Error(`Failed to execute command ${commandId}: ${errorMessage}`);
  }
};
