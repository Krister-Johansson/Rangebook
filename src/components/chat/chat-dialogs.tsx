import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { deleteChat, renameChat } from '#/server/chats'

export interface ChatRef {
  id: string
  title: string
}

type Dialog = { type: 'rename' | 'delete'; chat: ChatRef } | null

const sheetClass =
  'mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-xl sm:bottom-4 sm:rounded-xl sm:border'

/** Rename and delete for one chat, each behind a sheet that asks first. */
export function useChatDialogs() {
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => setDialog(null)
  const element = (
    <>
      <Sheet open={dialog?.type === 'rename'} onOpenChange={(o) => !o && close()}>
        <SheetContent side="bottom" className={sheetClass}>
          <SheetHeader>
            <SheetTitle>Rename chat</SheetTitle>
            <SheetDescription className="sr-only">Give this chat a name you will recognize.</SheetDescription>
          </SheetHeader>
          {dialog?.type === 'rename' ? <RenameForm chat={dialog.chat} onDone={close} /> : null}
        </SheetContent>
      </Sheet>
      <Sheet open={dialog?.type === 'delete'} onOpenChange={(o) => !o && close()}>
        <SheetContent side="bottom" className={sheetClass}>
          <SheetHeader>
            <SheetTitle>Delete this chat?</SheetTitle>
            <SheetDescription>
              {dialog ? `"${dialog.chat.title}" will be removed from this computer. You can't undo this.` : ''}
            </SheetDescription>
          </SheetHeader>
          <p className="px-4 text-sm text-muted-foreground">Questions you saved for clinic stay in Patterns, For clinic.</p>
          {dialog?.type === 'delete' ? <DeleteActions chat={dialog.chat} onDone={close} /> : null}
        </SheetContent>
      </Sheet>
    </>
  )
  return {
    rename: (chat: ChatRef) => setDialog({ type: 'rename', chat }),
    remove: (chat: ChatRef) => setDialog({ type: 'delete', chat }),
    element,
  }
}

function RenameForm({ chat, onDone }: { chat: ChatRef; onDone: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm({
    defaultValues: { title: chat.title },
    onSubmit: async ({ value }) => {
      try {
        await renameChat({ data: { id: chat.id, title: value.title.trim() } })
        await queryClient.invalidateQueries({ queryKey: ['chats'] })
        toast('Chat renamed')
        onDone()
      } catch {
        toast.error('Could not rename the chat. Try again.')
      }
    },
  })
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <div className="grid gap-1.5 px-4">
        <form.Field
          name="title"
          validators={{ onSubmit: ({ value }) => (value.trim() ? undefined : 'Write a name') }}
        >
          {(field) => (
            <>
              <Label htmlFor="chat-name">Name</Label>
              <Input
                id="chat-name"
                maxLength={80}
                autoFocus
                className="text-base md:text-sm"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={field.state.meta.errors.length > 0}
              />
              {field.state.meta.errors.length ? (
                <p role="alert" className="text-sm text-destructive">
                  {field.state.meta.errors.join(' ')}
                </p>
              ) : null}
            </>
          )}
        </form.Field>
      </div>
      <SheetFooter className="flex-row justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(submitting) => (
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving' : 'Save'}
            </Button>
          )}
        </form.Subscribe>
      </SheetFooter>
    </form>
  )
}

function DeleteActions({ chat, onDone }: { chat: ChatRef; onDone: () => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    try {
      await deleteChat({ data: { id: chat.id } })
      onDone()
      if (pathname === `/ask/${chat.id}`) await navigate({ to: '/ask', replace: true })
      queryClient.removeQueries({ queryKey: ['chats', chat.id], exact: true })
      await queryClient.invalidateQueries({ queryKey: ['chats'], exact: true })
      toast('Chat deleted from this computer')
    } catch {
      toast.error('Could not delete the chat. Try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <SheetFooter className="flex-row justify-end">
      <Button type="button" variant="ghost" onClick={onDone}>
        Cancel
      </Button>
      <Button type="button" variant="destructive" disabled={busy} onClick={confirm}>
        <Trash2 aria-hidden="true" />
        {busy ? 'Deleting' : 'Delete chat'}
      </Button>
    </SheetFooter>
  )
}
