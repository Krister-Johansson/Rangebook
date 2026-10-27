import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { IdCard, Laptop, Lock, Send, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { SectionCard } from '#/components/home/section-card'
import { BackHead } from '#/components/more/page-head'
import { SwitchRow } from '#/components/more/switch-row'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { chatStatusQuery, chatsQuery, peopleQuery, prefsQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { deleteAllChats } from '#/server/chats'
import { CHAT_MODELS, DEFAULT_CHAT_MODEL } from '#/server/chat/prompt'
import { setPref } from '#/server/preferences'
import type { Prefs } from '#/server/preferences'

import { modelName } from './text'
import { ChatOffNotice } from './chat-off'

function PrivacyItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className="-mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-3.5">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  )
}

// Who runs each model, for the line under its name.
const company = (id: string) => (id.startsWith('anthropic/') ? 'Anthropic' : id.split('/')[0])

export function ChatSettings() {
  const queryClient = useQueryClient()
  const { data: prefs } = useSuspenseQuery(prefsQuery)
  const { data: people } = useSuspenseQuery(peopleQuery)
  const { data: chats } = useQuery(chatsQuery)
  const { data: status } = useQuery(chatStatusQuery)
  const [confirm, setConfirm] = useState(false)
  const name = people.people.find((p) => p.id === people.activeId)?.name ?? 'this person'
  const count = chats?.length ?? 0
  const model = CHAT_MODELS.some((m) => m.id === prefs.chatModel) ? prefs.chatModel : DEFAULT_CHAT_MODEL

  const pref = useMutation({
    mutationFn: (data: Partial<Pick<Prefs, 'chatModel' | 'chatDayDetail'>>) => setPref({ data }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: prefsQuery.queryKey })
      const before = queryClient.getQueryData(prefsQuery.queryKey)
      queryClient.setQueryData(prefsQuery.queryKey, (old) => (old ? { ...old, ...data } : old))
      return { before }
    },
    onError: (_err, _data, ctx) => {
      if (ctx?.before) queryClient.setQueryData(prefsQuery.queryKey, ctx.before)
      toast.error('That setting was not saved. Try again.')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: prefsQuery.queryKey }),
  })

  const removeAll = useMutation({
    mutationFn: () => deleteAllChats(),
    onSuccess: ({ deleted }) => {
      setConfirm(false)
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'chats' && q.queryKey.length > 1 })
      toast(`${deleted} ${deleted === 1 ? 'chat' : 'chats'} for ${name} deleted`)
      return queryClient.invalidateQueries({ queryKey: ['chats'] })
    },
    onError: () => toast.error('Could not delete the chats. Try again.'),
  })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <BackHead
        back="More"
        backTo={{ to: '/more' }}
        title="Ask settings"
        sub="The chat uses the same lookups as the rest of the app. The app does the math, the model explains it."
      />
      {status && !status.enabled ? <ChatOffNotice /> : null}
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="flex flex-col gap-4">
          <SectionCard title="Your data and privacy" icon={ShieldCheck}>
            <ul className="flex flex-col gap-3">
              <PrivacyItem icon={<Lock />}>Nothing is sent until you ask something.</PrivacyItem>
              <PrivacyItem icon={<Send />}>
                When you ask, your message and the numbers the app looks up go through OpenRouter to the company
                behind the model you pick below.
              </PrivacyItem>
              <PrivacyItem icon={<ShieldCheck />}>
                Each request asks OpenRouter for providers that do not store your data or train on it.
              </PrivacyItem>
              <PrivacyItem icon={<IdCard />}>The name in the pump export is never sent.</PrivacyItem>
              <PrivacyItem icon={<Laptop />}>Chats are stored only on this computer.</PrivacyItem>
            </ul>
          </SectionCard>

          <SectionCard title="What the chat can read">
            <div className="flex flex-col gap-3">
              <SwitchRow
                id="chat-day-detail"
                label="Single days in detail"
                description="Readings, carbs and boluses for one day at a time. When this is off, the chat only sees summaries over several days."
                checked={prefs.chatDayDetail}
                onCheckedChange={(v) => pref.mutate({ chatDayDetail: v })}
              />
              <p className="text-sm text-muted-foreground">
                Always: weeks and other periods, patterns, the typical day, the week map, settings changes found in
                the export, the glossary and saved questions.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="What the chat will not do">
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
              <li>Give doses or new setting values.</li>
              <li>
                Tell you which way to change a setting. That is for you and your care team, and it can save a question
                for them instead.
              </li>
              <li>
                Help with something happening right now. For that, follow your care plan and the pump and CGM alerts,
                and get help from an adult, your care team or emergency services.
              </li>
            </ul>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard title="Model" description="Through OpenRouter. The key is in the app's server settings.">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="sr-only">Model</legend>
              {CHAT_MODELS.map((m) => {
                const checked = model === m.id
                const note = /\((.*)\)/.exec(m.label)?.[1]
                return (
                  <label
                    key={m.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-(--dur-press) ease-out hover:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                      checked && 'border-foreground/40 bg-accent/60',
                    )}
                  >
                    <input
                      type="radio"
                      name="chat-model"
                      value={m.id}
                      checked={checked}
                      onChange={() => pref.mutate({ chatModel: m.id })}
                      className="mt-0.5 size-4 shrink-0 accent-primary outline-none"
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-semibold">{modelName(m.label)}</span>
                      <span className="text-xs text-muted-foreground">
                        {note ? `${note[0].toUpperCase()}${note.slice(1)}. ` : m.id === DEFAULT_CHAT_MODEL ? 'Default. ' : ''}
                        Sent to {company(m.id)}.
                      </span>
                      <code className="font-mono text-[11px] [overflow-wrap:anywhere] text-muted-foreground">{m.id}</code>
                    </span>
                  </label>
                )
              })}
            </fieldset>
          </SectionCard>

          <SectionCard title={`Chats about ${name}`} description="Removes chats from this computer. Questions saved for clinic stay.">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <span className="text-sm text-muted-foreground">
                {count} {count === 1 ? 'chat' : 'chats'} on this computer
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/45 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={!count}
                onClick={() => setConfirm(true)}
              >
                <Trash2 aria-hidden="true" />
                Delete all chats for {name}
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      <Sheet open={confirm} onOpenChange={setConfirm}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-xl sm:bottom-4 sm:rounded-xl sm:border"
        >
          <SheetHeader>
            <SheetTitle>Delete all chats for {name}?</SheetTitle>
            <SheetDescription>
              {count} {count === 1 ? 'chat' : 'chats'} will be removed from this computer. You can't undo this.
            </SheetDescription>
          </SheetHeader>
          <p className="px-4 text-sm text-muted-foreground">Questions saved for clinic stay in Patterns, For clinic.</p>
          <SheetFooter className="flex-row justify-end">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={removeAll.isPending} onClick={() => removeAll.mutate()}>
              <Trash2 aria-hidden="true" />
              {removeAll.isPending ? 'Deleting' : 'Delete all'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
