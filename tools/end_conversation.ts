import { Type } from '@google/genai';
import type { ToolCallbacks } from '../types';
import { getErrorMessage } from '../utils/getErrorMessage';

type ToolArgs = Record<string, unknown>;

export const declaration = {
  name: 'end_conversation',
  description: 'End the current voice conversation session and stop the voice interface.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: []
  }
};

export const instruction = `
CONVERSATION CONTROL:
1. Use "end_conversation" when the user indicates they want to stop talking or end the conversation.
2. This will immediately stop the voice interface and disconnect the session.
3. Do NOT say "Done." after calling this. The session will simply end.`;

export const execute = async (_args: ToolArgs, callbacks: ToolCallbacks): Promise<{ status: string }> => {
  try {
    await callbacks.onSystem('Ending conversation...', {
      name: 'end_conversation',
      filename: 'Session',
      status: 'success'
    });
    
    // Don't archive here - let the stopSession callback handle it
    // This avoids the race condition where conversation continues after archive
    
    // Call the stop callback if available
    if (callbacks.onStopSession) {
      await callbacks.onStopSession();
    }
    
    return { status: 'conversation_ended' };
  } catch (error) {
    // Even if something fails, we still want to indicate the conversation should end
    console.error(`Error in end_conversation: ${getErrorMessage(error)}`);
    return { status: 'conversation_ended_with_errors' };
  }
};
