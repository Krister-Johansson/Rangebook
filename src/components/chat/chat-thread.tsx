import { fetchServerSentEvents, useChat } from '@tanstack/ai-react'
import type { UIMessage } from '@tanstack/ai-react'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { CircleAlert, Ellipsis, History, Pencil, RotateCcw, Square, SquarePen, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '#/components/ui/sheet'
import { chatQuery, chatsQuery, peopleQuery, prefsQuery } from '#/lib/queries'
import { saveChat } from '#/server/chats'
import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from '#/server/chat/prompt'

import { useChatDialogs } from './chat-dialogs'
import { SheetChats } from './chat-history'
import { Composer } from './composer'
import { EmptyChat } from './empty-chat'
import { AssistantMessage, Thinking, UserMessage } from './messages'
import { errorText, modelName } from './text'
import { groupTurns } from './turns'

// The chat streams from /api/chat, which always answers about the person
// selected in the app (the cookie). One connection for every thread.
const connection = fetchServerSentEvents('/api/chat')

function parseMessages(json: string): UIMessage[] {
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : []
  } catch {
    return []
  }
}

/** The page for one chat: loads the saved thread and remounts it per thread and person. */
export function ChatPage({ threadId }: { threadId: string }) {
  const { data: chat } = useSuspenseQuery(chatQuery(threadId))
  const { data: people } = useSuspenseQuery(peopleQuery)
  const navigate = useNavigate()
  const person = people.people.find((p) => p.id === people.activeId)

  // A thread belongs to one person. After switching person, start a new chat
  // instead of showing this id under someone else's name.
  const firstPerson = useRef(people.activeId)
  useEffect(() => {
    if (people.activeId !== firstPerson.current) navigate({ to: '/ask', replace: true })
  }, [people.activeId, navigate])

  if (!person) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-start gap-3 py-10">
        <h1 className="text-[22px] font-bold tracking-tight">Add a person first</h1>
        <p className="text-muted-foreground">The chat answers questions about the person selected in the app.</p>
        <Button asChild>
          <Link to="/people">
            <UserPlus aria-hidden="true" />
            Add a person
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <ChatThread
      key={`${people.activeId}:${threadId}`}
      threadId={threadId}
      name={person.name}
      initialMessages={parseMessages(chat.messagesJson)}
    />
  )
}

const nearBottom = () =>
  window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160

const toBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight })

function ChatThread({
  threadId,
  name,
  initialMessages,
}: {
  threadId: string
  name: string
  initialMessages: UIMessage[]
}) {
  const queryClient = useQueryClient()
  const { data: prefs } = useQuery(prefsQuery)
  const { data: chats } = useQuery(chatsQuery)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [stopped, setStopped] = useState(false)
  const dialogs = useChatDialogs()

  const { messages, sendMessage, isLoading, error, stop, reload } = useChat({
    connection,
    threadId,
    initialMessages,
  })

  const listed = chats?.find((c) => c.id === threadId)
  const title = listed?.title ?? 'New chat'
  const model = CHAT_MODELS.find((m) => m.id === prefs?.chatModel) ?? CHAT_MODELS.find((m) => m.id === DEFAULT_CHAT_MODEL)!

  // Save the whole thread when a run ends (finished, stopped or failed) and
  // there is an answer to keep.
  const wasLoading = useRef(false)
  useEffect(() => {
    const ended = wasLoading.current && !isLoading
    wasLoading.current = isLoading
    if (!ended || !messages.some((m) => m.role === 'assistant')) return
    const messagesJson = JSON.stringify(messages)
    saveChat({ data: { id: threadId, messagesJson } })
      .then(() => {
        queryClient.setQueryData(chatQuery(threadId).queryKey, (old) =>
          old ? { id: old.id, title: old.title, messagesJson, exists: true as const } : old,
        )
        return queryClient.invalidateQueries({ queryKey: ['chats'] })
      })
      .catch(() => toast.error('This chat was not saved. It stays on screen until you leave the page.'))
  }, [isLoading, messages, threadId, queryClient])

  // Follow a streaming answer while the reader stays at the bottom.
  const follow = useRef(true)
  useEffect(() => {
    if (!isLoading) return
    const onScroll = () => {
      follow.current = nearBottom()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isLoading])
  useEffect(() => {
    if (isLoading && follow.current) toBottom()
  }, [messages, isLoading])

  const send = (text: string) => {
    setStopped(false)
    follow.current = true
    void sendMessage(text)
    requestAnimationFrame(toBottom)
  }
  const retry = () => {
    setStopped(false)
    follow.current = true
    void reload()
  }
  const onStop = () => {
    setStopped(true)
    stop()
  }

  const turns = groupTurns(messages)
  const last = turns[turns.length - 1]
  let answerCount = 0

  return (
    <div className="-mb-28 flex min-h-[calc(100dvh-4.5rem-env(safe-area-inset-top))] w-full flex-col pb-[calc(3.5rem+1px+env(safe-area-inset-bottom))] md:-mb-10 md:pb-0">
      <div className="mx-auto flex w-full max-w-[720px] items-center gap-1 border-b pb-3">
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <h1 className="truncate font-semibold">{title}</h1>
          <p className="truncate text-xs text-muted-foreground">About {name}'s data</p>
        </div>
        <Button variant="outline" size="sm" className="md:hidden" onClick={() => setHistoryOpen(true)}>
          <History aria-hidden="true" />
          Chats
        </Button>
        {messages.length ? (
          <Button variant="ghost" size="icon" className="md:hidden" asChild>
            <Link to="/ask" aria-label="New chat">
              <SquarePen aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        {listed ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Chat options">
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem onSelect={() => dialogs.rename(listed)}>
                <Pencil aria-hidden="true" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => dialogs.remove(listed)}>
                <Trash2 aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col">
        {messages.length ? (
          <div className="flex flex-col gap-[18px] pt-[18px] pb-7">
            {turns.map((m) => {
              if (m.role === 'user') return <UserMessage key={m.id} message={m} />
              answerCount += 1
              const isLast = m === last
              return (
                <AssistantMessage
                  key={m.id}
                  message={m}
                  live={isLast && isLoading}
                  stopped={isLast && stopped && !isLoading}
                  saveId={`chat-${threadId}-${answerCount}`}
                  onRetry={retry}
                />
              )
            })}
            {last?.role === 'user' && stopped && !isLoading ? (
              <div className="flex items-center gap-1.5 pl-1 text-xs text-muted-foreground">
                <Square aria-hidden="true" className="size-2.5 fill-current" />
                Stopped.
                <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={retry}>
                  <RotateCcw aria-hidden="true" className="size-3" />
                  Ask again
                </Button>
              </div>
            ) : null}
            {last?.role === 'user' && isLoading ? <Thinking /> : null}
            {error && !isLoading ? (
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertTitle>The answer did not come through</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-2">
                  <p>{errorText(error)}</p>
                  <Button variant="outline" size="sm" onClick={retry}>
                    <RotateCcw aria-hidden="true" />
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : (
          <EmptyChat name={name} onSend={send} />
        )}
        <p className="sr-only" aria-live="polite">
          {isLoading ? 'Writing an answer.' : messages.length && last?.role === 'assistant' ? 'Answer ready.' : ''}
        </p>
      </div>

      <div className="sticky bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-auto bg-background/95 px-4 pt-2 pb-2.5 backdrop-blur md:bottom-0 md:mx-0 md:px-0 md:pb-4">
        <div className="mx-auto w-full max-w-[720px]">
          <Composer name={name} model={modelName(model.label)} streaming={isLoading} onSend={send} onStop={onStop} />
        </div>
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent
          side="bottom"
          // No keyboard popping up on phones: focus stays on the sheet.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-xl sm:bottom-4 sm:rounded-xl sm:border">
          <SheetHeader className="pb-0">
            <SheetTitle>Chats about {name}</SheetTitle>
            <SheetDescription className="sr-only">Open, rename or delete a chat.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <SheetChats onPick={() => setHistoryOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      {dialogs.element}
    </div>
  )
}
