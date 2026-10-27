import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronsUpDown, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { peopleQuery } from '#/lib/queries'
import { useSwitchPerson } from '#/lib/use-switch-person'
import { cn } from '#/lib/utils'

/** First visible character, so a name that starts with an emoji is not cut in half. */
function firstGrapheme(name: string) {
  const first = [...new Intl.Segmenter().segment(name.trim())][0]?.segment
  return first ? first.toUpperCase() : '?'
}

export function Initial({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground',
        className,
      )}
    >
      {firstGrapheme(name)}
    </span>
  )
}

/** Picks whose data the app shows. `compact` is the round button for the phone header. */
export function PersonSwitcher({ compact = false }: { compact?: boolean }) {
  const { data } = useSuspenseQuery(peopleQuery)
  const switchPerson = useSwitchPerson()
  const [busy, setBusy] = useState(false)
  const active = data.people.find((p) => p.id === data.activeId)

  if (!active) {
    return (
      <Button variant={compact ? 'ghost' : 'outline'} size={compact ? 'icon' : 'sm'} asChild>
        <Link to="/people" aria-label="Add a person">
          <UserPlus />
          {compact ? null : 'Add a person'}
        </Link>
      </Button>
    )
  }

  const choose = async (value: string) => {
    const id = Number(value)
    if (id === data.activeId) return
    setBusy(true)
    try {
      await switchPerson(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not switch person')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={busy}>
        {compact ? (
          <Button variant="ghost" size="icon" aria-label={`Showing ${active.name}. Switch person`}>
            <Initial name={active.name} />
          </Button>
        ) : (
          <Button variant="outline" className="h-auto w-full justify-start gap-2 px-2 py-1.5">
            <Initial name={active.name} />
            <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{active.name}</span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Show data for</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={String(data.activeId)} onValueChange={choose}>
          {data.people.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={String(p.id)}>
              <span className="truncate">{p.name}</span>
              {p.imports === 0 ? (
                <span className="ml-auto shrink-0 text-xs whitespace-nowrap text-muted-foreground">No data</span>
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/people">
            <Users />
            Manage people
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
