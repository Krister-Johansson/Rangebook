import { Link } from '@tanstack/react-router'
import { Bot, ExternalLink, Info, MessageCircleOff } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

const KEY_LINE = 'OPENROUTER_API_KEY="sk-or-..."'

/**
 * Shown instead of the chat when no OpenRouter key is set. The rest of the
 * app works without it.
 */
export function ChatOffNotice({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="chat-off-title"
      className={cn('flex flex-col gap-4 rounded-xl border bg-card p-5 text-card-foreground', className)}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <MessageCircleOff aria-hidden="true" className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id="chat-off-title" className="text-lg font-semibold">
            The chat is off
          </h2>
          <p className="text-sm text-muted-foreground">
            Everything else in Rangebook works without it. The chat needs an OpenRouter key, which you create
            yourself.
          </p>
        </div>
      </div>

      <ol className="ml-5 list-decimal space-y-2 text-sm">
        <li>
          Create a key at{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
          >
            openrouter.ai/keys
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          . Using the chat costs a little per question, paid to OpenRouter.
        </li>
        <li>
          Add it to the file <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code> in
          the Rangebook folder:
          <pre className="mt-1.5 overflow-x-auto rounded-lg border bg-muted/50 p-2.5 font-mono text-xs">
            <code>{KEY_LINE}</code>
          </pre>
        </li>
        <li>Restart the app (stop it and run pnpm dev again).</li>
      </ol>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
        With the chat on, your question and the numbers the app looks up are sent through OpenRouter to the
        model's company. The name in the pump export is never sent.
      </p>

      <Button variant="outline" asChild className="self-start">
        <Link to="/ask-claude" search={{ app: 'desktop' }}>
          <Bot aria-hidden="true" />
          Or ask Claude through the MCP server
        </Link>
      </Button>
    </section>
  )
}

/** One line for the sidebar when the chat is off. */
export function ChatOffRow() {
  return (
    <Link
      to="/ask"
      className="mx-2 flex items-start gap-2 rounded-lg px-2 py-2 text-xs text-muted-foreground no-underline transition-colors duration-(--dur-press) hover:bg-accent hover:text-foreground"
    >
      <MessageCircleOff aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span>
        The chat is off. <span className="font-medium text-foreground underline underline-offset-4">How to turn it on</span>
      </span>
    </Link>
  )
}
