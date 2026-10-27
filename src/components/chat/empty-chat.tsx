import { Link } from '@tanstack/react-router'
import { ArrowDown, CalendarDays, GitCompareArrows, Lock, MessageCircle, Stethoscope } from 'lucide-react'

export const STARTERS = [
  { text: 'How was this week?', icon: CalendarDays },
  { text: 'Why do I go low after lunch?', icon: ArrowDown },
  { text: 'What should we ask at the next clinic visit?', icon: Stethoscope },
  { text: 'Compare before and after the last settings change', icon: GitCompareArrows },
] as const

/** A new chat: what it does, four starter questions and the privacy line. */
export function EmptyChat({ name, onSend }: { name: string; onSend: (text: string) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col items-start gap-2.5 pt-4 pb-4 md:pt-10">
      <span className="mb-1 grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
        <MessageCircle aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-[22px] leading-tight font-bold tracking-tight">Ask about {name}'s data</h2>
      <p className="max-w-[52ch] text-muted-foreground">
        The app looks things up and does the math. The chat explains it in plain words and helps you find questions
        for your care team. It never gives doses or new settings.
      </p>
      <ul className="mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Questions to start with">
        {STARTERS.map((s) => (
          <li key={s.text} className="flex">
            <button
              type="button"
              onClick={() => onSend(s.text)}
              className="flex min-h-13 w-full items-start gap-2.5 rounded-xl border bg-card p-3 text-left text-[13.5px] leading-snug font-semibold transition-[background-color,transform] duration-(--dur-press) ease-out outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98] motion-reduce:active:scale-100"
            >
              <s.icon aria-hidden="true" className="mt-px size-4 shrink-0 text-muted-foreground" />
              <span>{s.text}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Lock aria-hidden="true" className="size-3" />
        <span>Nothing is sent until you ask something.</span>
        <Link
          to="/more/chat"
          className="rounded-sm font-semibold text-foreground underline underline-offset-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          How it works
        </Link>
      </p>
    </div>
  )
}
