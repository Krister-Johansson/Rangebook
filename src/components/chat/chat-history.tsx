import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { Ellipsis, Laptop, Pencil, Search, SquarePen, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import {
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '#/components/ui/sidebar'
import { chatsQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import type { ChatListItem } from '#/server/chats'

import { useChatDialogs } from './chat-dialogs'
import type { ChatRef } from './chat-dialogs'
import { relativeDay } from './text'

function useChatSearch() {
  const { data: chats, isPending } = useQuery(chatsQuery)
  const [q, setQ] = useState('')
  const s = q.trim().toLowerCase()
  const list = (chats ?? []).filter((c) => !s || `${c.title} ${c.preview}`.toLowerCase().includes(s))
  return { chats: chats ?? [], list, q, setQ, isPending, searching: !!s }
}

const activeThread = (pathname: string) => (pathname.startsWith('/ask/') ? pathname.slice('/ask/'.length) : null)

function RowMenu({
  chat,
  onRename,
  onDelete,
  trigger,
}: {
  chat: ChatRef
  onRename: (c: ChatRef) => void
  onDelete: (c: ChatRef) => void
  trigger: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onSelect={() => onRename(chat)}>
          <Pencil aria-hidden="true" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(chat)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The person's chats in the desktop sidebar: New chat, search and the list. */
export function SidebarChats() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const current = activeThread(pathname)
  const { chats, list, q, setQ, isPending, searching } = useChatSearch()
  const dialogs = useChatDialogs()
  const isNew = current !== null && !chats.some((c) => c.id === current)

  return (
    <div className="flex flex-col gap-1.5">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isNew}>
            <Link to="/ask">
              <SquarePen />
              New chat
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <div className="relative px-0.5">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <SidebarInput
            type="search"
            placeholder="Search chats"
            aria-label="Search chats"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-7 text-[13px]"
          />
        </div>
      <SidebarMenu aria-label="Chats">
        {isPending ? (
          <>
            <SidebarMenuItem>
              <SidebarMenuSkeleton />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuSkeleton />
            </SidebarMenuItem>
          </>
        ) : null}
        {list.map((c) => (
          <SidebarMenuItem key={c.id}>
            <SidebarMenuButton asChild isActive={c.id === current} className="pr-8">
              <Link to="/ask/$threadId" params={{ threadId: c.id }} title={c.title}>
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground transition-opacity duration-(--dur-press) group-focus-within/menu-item:opacity-0 group-hover/menu-item:opacity-0">
                  {relativeDay(c.updatedAt)}
                </span>
              </Link>
            </SidebarMenuButton>
            <RowMenu
              chat={c}
              onRename={dialogs.rename}
              onDelete={dialogs.remove}
              trigger={
                <SidebarMenuAction showOnHover aria-label={`Options for ${c.title}`}>
                  <Ellipsis />
                </SidebarMenuAction>
              }
            />
          </SidebarMenuItem>
        ))}
        {!isPending && !list.length ? (
          <li className="px-2 py-1.5 text-xs text-muted-foreground">
            {searching ? `No chats match "${q.trim()}".` : 'No chats yet. Questions you ask show up here.'}
          </li>
        ) : null}
      </SidebarMenu>
      {dialogs.element}
    </div>
  )
}

/** The person's chats in the phone sheet, with a short preview of each answer. */
export function SheetChats({ onPick }: { onPick: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const current = activeThread(pathname)
  const { list, q, setQ, isPending, searching } = useChatSearch()
  const dialogs = useChatDialogs()

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button size="sm" asChild>
          <Link to="/ask" onClick={onPick}>
            <SquarePen aria-hidden="true" />
            New chat
          </Link>
        </Button>
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search chats"
            aria-label="Search chats"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 pl-8 text-base md:text-sm"
          />
        </div>
      </div>
      <ul aria-label="Chats" className="-mx-2 flex flex-col gap-0.5">
        {list.map((c: ChatListItem) => (
          <li
            key={c.id}
            className={cn(
              'flex items-stretch rounded-[10px] transition-colors duration-(--dur-press) hover:bg-accent/70',
              c.id === current && 'bg-accent hover:bg-accent',
            )}
          >
            <Link
              to="/ask/$threadId"
              params={{ threadId: c.id }}
              onClick={onPick}
              aria-current={c.id === current ? 'page' : undefined}
              className="flex min-h-15 min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-[10px] py-2.5 pr-1 pl-2.5 text-foreground no-underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className={cn('truncate text-sm font-semibold', c.id === current && 'font-bold')}>{c.title}</span>
              {c.preview ? <span className="truncate text-xs text-muted-foreground">{c.preview}</span> : null}
            </Link>
            <div className="flex shrink-0 flex-col items-end justify-between py-2 pr-1">
              <span className="pr-1.5 text-[11.5px] whitespace-nowrap text-muted-foreground">{relativeDay(c.updatedAt)}</span>
              <RowMenu
                chat={c}
                onRename={dialogs.rename}
                onDelete={dialogs.remove}
                trigger={
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`Options for ${c.title}`}>
                    <Ellipsis />
                  </Button>
                }
              />
            </div>
          </li>
        ))}
        {!isPending && !list.length ? (
          <li className="px-2 py-3 text-sm text-muted-foreground">
            {searching ? `No chats match "${q.trim()}".` : 'No chats yet.'}
          </li>
        ) : null}
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Laptop aria-hidden="true" className="size-3.5" />
        Chats are stored only on this computer.
      </p>
      {dialogs.element}
    </div>
  )
}
