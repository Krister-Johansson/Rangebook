import { Link } from '@tanstack/react-router'
import { ArrowUp, Square } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'

import { Button } from '#/components/ui/button'

/** Message box: Enter sends, Shift+Enter adds a line. Stop shows while an answer streams. */
export function Composer({
  name,
  model,
  streaming,
  onSend,
  onStop,
}: {
  name: string
  model: string
  streaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(140, el.scrollHeight)}px`
  }, [text])

  const submit = () => {
    const v = text.trim()
    if (!v || streaming) return
    onSend(v)
    setText('')
  }

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="flex items-end gap-2 rounded-[22px] border bg-card py-1.5 pr-1.5 pl-4 shadow-xs transition-[border-color,box-shadow] duration-(--dur-press) ease-out focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
        <textarea
          ref={ref}
          rows={1}
          aria-label="Message"
          placeholder={`Ask about ${name}'s data`}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          className="block max-h-[140px] min-h-9 min-w-0 flex-1 resize-none bg-transparent py-[7px] text-base leading-snug text-foreground outline-none placeholder:text-muted-foreground"
        />
        {streaming ? (
          <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 rounded-full" onClick={onStop}>
            <Square aria-hidden="true" className="size-3 fill-current" />
            Stop
          </Button>
        ) : (
          <Button type="submit" size="icon" className="size-9 shrink-0 rounded-full" aria-label="Send" disabled={!text.trim()}>
            <ArrowUp aria-hidden="true" />
          </Button>
        )}
      </div>
      <p className="text-center text-[11.5px] text-muted-foreground">
        <Link
          to="/more/chat"
          className="rounded-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Via OpenRouter to {model}
        </Link>
      </p>
    </form>
  )
}
