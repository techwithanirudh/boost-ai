import { stepCountIs, ToolLoopAgent } from 'ai';
import { systemPrompt } from '~/lib/ai/prompts';
import { provider } from '~/lib/ai/providers';
import logger from '~/lib/logger';
import type {
  ChatRequestHints,
  SlackFile,
  SlackMessageContext,
  Stream,
} from '~/types';

export const orchestratorAgent = ({
  context,
  requestHints
}: {
  context: SlackMessageContext;
  requestHints: ChatRequestHints;
}) =>
  new ToolLoopAgent({
    model: provider.languageModel('chat-model'),
    instructions: systemPrompt({
      agent: 'chat',
      requestHints,
      context,
    }),
    toolChoice: 'required',
    tools: {
        
    },
    stopWhen: [
      stepCountIs(10),
    ],
  });