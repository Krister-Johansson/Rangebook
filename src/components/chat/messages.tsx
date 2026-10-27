import type { UIMessage } from '@tanstack/ai-react'
import { Database, RotateCcw, Square } from 'lucide-react'

import { Button } from '#/components/ui/button'

import { ResultCard } from './cards'
import { RichBlock } from './rich-text'
import { SaveFromAnswer } from './save-question-sheet'
import { parseBlocks } from './text'
import { cardFor, describeTool, parseResult, toolInput } from './tool-info'
import type { CardKind, ToolView } from './tool-info'
import { ToolStep, argsText } from './tool-step'
import type { StepState } from './tool-step'

type Part = UIMessage['parts'][number]
type ToolCall = Extract<Part, { type: 'tool-call' }>
type ToolResult = Extract<Part, { type: 'tool-result' }>

export function messageText(message: UIMessage) {
  return message.parts
    .filter((p): p is Extract<Part, { type: 'text' }> => p.type === 'text')
    .map((p) => p.content)
    .join('\n\n')
    .trim()
}

export function UserMessage({ message }: { message: UIMessage }) {
  return (
    <div className="max-w-[85%] self-end rounded-[18px_18px_4px_18px] bg-primary px-3.5 py-2 text-[14.5px] leading-[1.45] whitespace-pre-wrap text-primary-foreground [overflow-wrap:anywhere]">
      {messageText(message)}
    </div>
  )
}

interface Step {
  id: string
  name: string
  input: Record<string, unknown>
  view: ToolView
  state: StepState
  error?: string
  card: CardKind | null
  output: unknown
}

function stepsOf(message: UIMessage, live: boolean): Step[] {
  const results = new Map<string, ToolResult>()
  for (const p of message.parts) if (p.type === 'tool-result') results.set(p.toolCallId, p)
  return message.parts
    .filter((p): p is ToolCall => p.type === 'tool-call')
    .map((call) => {
      const input = toolInput(call)
      const result = results.get(call.id)
      const output = result && result.state !== 'error' ? parseResult(result.content) : call.output
      const error = result?.state === 'error' ? result.error || 'The lookup did not work.' : undefined
      const state: StepState = error ? 'error' : output !== undefined ? 'done' : live ? 'running' : 'stopped'
      return {
        id: call.id,
        name: call.name,
        input,
        view: describeTool(call.name, input, state === 'done' ? output : undefined),
        state,
        error,
        card: state === 'done' ? cardFor(call.name, output) : null,
        output,
      }
    })
}

export function Thinking() {
  return (
    <div
      role="status"
      aria-label="Writing an answer"
      className="inline-flex gap-[5px] self-start rounded-[4px_18px_18px_18px] border bg-card px-4 py-3.5"
    >
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="size-1.5 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  )
}

/**
 * One answer: lookups as chips, the text with cards after the first
 * paragraph, and a marker when the numbers came from the app's own lookups.
 */
export function AssistantMessage({
  message,
  live,
  stopped,
  saveId,
  onRetry,
}: {
  message: UIMessage
  live: boolean
  stopped: boolean
  saveId: string
  onRetry: () => void
}) {
  const steps = stepsOf(message, live)
  const text = messageText(message)
  const blocks = parseBlocks(text)
  const cards = steps.filter((s) => s.card)
  const looked = steps.filter((s) => s.state === 'done' && !s.view.skipped).length
  const thinking = live && !text && !steps.some((s) => s.state === 'running')

  return (
    <div className="flex min-w-0 flex-col gap-2 self-stretch">
      {steps.length ? (
        <div className="flex flex-col items-start gap-1.5" role="list" aria-label="Lookups">
          {steps.map((s) => (
            <div role="listitem" key={s.id} className="max-w-full">
              <ToolStep view={s.view} state={s.state} tool={s.name} args={argsText(s.input)} error={s.error} />
            </div>
          ))}
        </div>
      ) : null}
      {blocks.length || cards.length ? (
        <div className="flex min-w-0 flex-col gap-2.5 rounded-[4px_18px_18px_18px] border bg-card px-3.5 pt-3 pb-3.5 text-[14.5px] leading-[1.55] [overflow-wrap:anywhere]">
          {blocks.slice(0, 1).map((b, i) => (
            <RichBlock key={`b${i}`} block={b} />
          ))}
          {cards.map((s) => (
            <ResultCard key={s.id} kind={s.card!} output={s.output} />
          ))}
          {blocks.slice(1).map((b, i) => (
            <RichBlock key={`r${i}`} block={b} />
          ))}
        </div>
      ) : null}
      {thinking ? <Thinking /> : null}
      {stopped ? (
        <div className="flex items-center gap-1.5 pl-1 text-xs text-muted-foreground">
          <Square aria-hidden="true" className="size-2.5 fill-current" />
          Stopped.
          <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={onRetry}>
            <RotateCcw aria-hidden="true" className="size-3" />
            Ask again
          </Button>
        </div>
      ) : null}
      {!live && (looked > 0 || text) ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pl-0.5">
          {looked > 0 ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-2 pl-1.5 font-bold">
                <Database aria-hidden="true" className="size-3" />
                From your data
              </span>
              <span className="text-muted-foreground">
                {looked} {looked === 1 ? 'lookup' : 'lookups'}. The app worked out the numbers.
              </span>
            </span>
          ) : (
            <span />
          )}
          {text ? <SaveFromAnswer patternId={saveId} answer={text} /> : null}
        </div>
      ) : null}
    </div>
  )
}
