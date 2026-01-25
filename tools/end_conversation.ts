import { Type } from '@google/genai';
import { archiveConversation } from '../utils/archiveConversation';

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

export const execute = async (args: any, callbacks: any): Promise<any> => {
  callbacks.onSystem("Ending conversation...", {
    name: 'end_conversation',
    filename: 'Session',
    status: 'success'
  });
  
  // Archive the conversation before ending it
  if (callbacks.onArchiveConversation) {
    try {
      await callbacks.onArchiveConversation();
    } catch (err: any) {
      callbacks.onLog(`Failed to archive conversation: ${err.message}`, 'error');
    }
  }
  
  // Call the stop callback if available
  if (callbacks.onStopSession) {
    callbacks.onStopSession();
  }
  
  return { status: "conversation_ended" };
};
