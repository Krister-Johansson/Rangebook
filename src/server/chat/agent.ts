import { chat, maxIterations } from '@tanstack/ai'
import type { AnyTextAdapter, ModelMessage, UIMessage } from '@tanstack/ai'
import { openRouterText } from '@tanstack/ai-openrouter'

import { DEFAULT_CHAT_MODEL, chatSystemPrompt } from './prompt'
import type { ChatModelId } from './prompt'
import { createChatTools } from './tools'
import type { ChatDeps } from './tools'

// At most this many model turns per question; one turn can call several tools.
export const MAX_TURNS = 8

export interface RunChatOptions {
  adapter: AnyTextAdapter
  // One chat thread; the client sends the same id for every message in it.
  threadId: string
  messages: Array<ModelMessage | UIMessage>
  personName: string
  today: string
  deps: ChatDeps
  abortController?: AbortController
}

/** One chat run: the model calls tools until it can answer, then streams the answer. */
export function runChat({ adapter, threadId, messages, personName, today, deps, abortController }: RunChatOptions) {
  return chat({
    adapter,
    threadId,
    messages,
    systemPrompts: [chatSystemPrompt(personName, today)],
    tools: createChatTools(deps),
    agentLoopStrategy: maxIterations(MAX_TURNS),
    // Route only to providers that do not store or train on requests.
    modelOptions: { provider: { data_collection: 'deny' } },
    abortController,
  })
}

/** OpenRouter adapter. Reads OPENROUTER_API_KEY from the server environment. */
export function openRouterAdapter(model: ChatModelId = DEFAULT_CHAT_MODEL) {
  return openRouterText(model)
}
