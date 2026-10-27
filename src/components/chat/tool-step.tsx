import { Check, ChevronDown, LoaderCircle, Minus, X } from 'lucide-react'
import { useId, useState } from 'react'

import { cn } from '#/lib/utils'

import type { ToolView } from './tool-info'

export type StepState = 'running' | 'done' | 'stopped' | 'error'

/** One lookup as a small chip. Opens to show the tool, its input and a few numbers. */
export function ToolStep({
  view,
  state,
  tool,
  args,
  error,
}: {
  view: ToolView
  state: StepState
  tool: string
  args: string
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const running = state === 'running'
  const Icon = running ? LoaderCircle : state === 'stopped' || state === 'error' ? X : view.skipped ? Minus : Check
  const label = running
    ? view.running
    : state === 'stopped'
      ? `${view.running}, stopped`
      : state === 'error'
        ? `${view.running}, did not work`
        : view.label

  return (
    <div className="max-w-full rounded-[14px] border bg-background">
      <button
        type="button"
        aria-expanded={running ? undefined : open}
        aria-controls={running ? undefined : bodyId}
        disabled={running}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-8 w-full items-center gap-2 rounded-[14px] py-1 pr-2.5 pl-1.5 text-left text-[12.5px] font-semibold text-muted-foreground transition-colors duration-(--dur-press) ease-out outline-none hover:enabled:bg-accent hover:enabled:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
          running && 'text-foreground',
        )}
      >
        <span
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-full',
            state === 'done' && !view.skipped ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            running && 'text-foreground',
          )}
        >
          <Icon aria-hidden="true" className={cn('size-3', running && 'animate-spin motion-reduce:animate-none')} />
        </span>
        <span className="min-w-0 flex-1">{label}</span>
        {running ? null : (
          <ChevronDown
            aria-hidden="true"
            className={cn('size-3.5 shrink-0 transition-transform duration-(--dur-pop) ease-out motion-reduce:transition-none', open && 'rotate-180')}
          />
        )}
      </button>
      {open && !running ? (
        <div id={bodyId} className="flex flex-col gap-1.5 pt-0.5 pr-3 pb-2.5 pl-[34px]">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
            <code className="rounded-[5px] bg-muted px-1.5 py-px font-mono text-[11.5px] text-foreground">{tool}</code>
            {args ? <span className="break-all text-muted-foreground">{args}</span> : null}
          </div>
          {error ? (
            <p className="text-xs text-muted-foreground">{error}</p>
          ) : view.rows.length ? (
            <dl className="m-0 flex flex-col text-[12.5px]">
              {view.rows.map(([k, v], i) => (
                <div key={`${k}-${i}`} className="flex justify-between gap-3 border-b py-1 last:border-b-0">
                  <dt className="min-w-0 text-muted-foreground">{k}</dt>
                  <dd className="m-0 text-right font-bold tabular-nums [overflow-wrap:anywhere]">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">
              {view.skipped ? 'Not read. Single days in detail are off in Ask settings.' : 'No numbers to show for this one.'}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Tool input as short "key value" text for the open chip. */
export function argsText(input: Record<string, unknown>) {
  return Object.entries(input)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k.replace(/_/g, ' ')} ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ')
}
