
import { Type } from '@google/genai';

export const declaration = {
  name: 'topic_switch',
  description: 'Signal that a major topic shift has occurred. Provide a summary of the previous conversation.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: 'A short one-sentence summary of the preceding conversation.' }
    },
    required: ['summary']
  }
};

export const instruction = `
TOPIC SWITCHING: 
1. Monitor for harsh topic switches.
2. If a switch occurs (not at start), call "topic_switch" with a summary of the segment that just ended.
3. Respond with "Done." then continue with the new topic.`;

export const execute = async (args: any, callbacks: any): Promise<any> => {
  callbacks.onSystem("Context Update", {
    name: 'topic_switch',
    filename: 'Session Context',
    newContent: args.summary
  });
  return { status: "context_reset" };
};
