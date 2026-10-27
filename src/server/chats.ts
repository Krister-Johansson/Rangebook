import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db'
import { chatThreads } from '#/db/schema'
import { activePersonId, requirePersonId } from './active-person'
import { chatStatusFrom } from './chat/status'

// Chat threads of the person being viewed. Every call checks the person, so a
// thread id from another person's chat never opens here.

const threadId = z.string().min(8).max(100)

/** Whether the chat is on (an OpenRouter key is set, or fake mode). */
export const getChatStatus = createServerFn({ method: 'GET' }).handler(() => chatStatusFrom(process.env))

export interface ChatListItem {
  id: string
  title: string
  preview: string
  updatedAt: string
}

/** Text of the first text part of a UI message. */
function textOf(message: unknown): string {
  const parts = (message as { parts?: { type: string; content?: string }[] })?.parts ?? []
  return parts.find((p) => p.type === 'text')?.content?.trim() ?? ''
}

const titleFrom = (messages: unknown[]) => {
  const first = messages.find((m) => (m as { role?: string }).role === 'user')
  const text = textOf(first).replace(/\s+/g, ' ')
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}...` : text || 'New chat'
}

export const listChats = createServerFn({ method: 'GET' }).handler(async (): Promise<ChatListItem[]> => {
  const personId = await activePersonId()
  if (personId === null) return []
  const rows = await db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.personId, personId))
    .orderBy(desc(chatThreads.updatedAt))
  return rows.map((r) => {
    const last = [...r.messages].reverse().find((m) => (m as { role?: string }).role === 'assistant')
    const preview = textOf(last).replace(/\s+/g, ' ')
    return {
      id: r.id,
      title: r.title,
      preview: preview.length > 90 ? `${preview.slice(0, 87).trimEnd()}...` : preview,
      updatedAt: r.updatedAt.toISOString(),
    }
  })
})

/**
 * One thread, or an empty one when the id is new. Messages travel as a JSON
 * string: they are the chat client's own objects, not typed here.
 */
export const getChat = createServerFn({ method: 'GET' })
  .validator(z.object({ id: threadId }))
  .handler(async ({ data }) => {
    const personId = await activePersonId()
    if (personId === null) return { id: data.id, title: 'New chat', messagesJson: '[]', exists: false }
    const [row] = await db
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.id, data.id), eq(chatThreads.personId, personId)))
    return row
      ? { id: row.id, title: row.title, messagesJson: JSON.stringify(row.messages), exists: true }
      : { id: data.id, title: 'New chat', messagesJson: '[]', exists: false }
  })

/** Saves the whole thread after an answer finishes. The title comes from the first question. */
export const saveChat = createServerFn({ method: 'POST' })
  .validator(z.object({ id: threadId, messagesJson: z.string().max(5_000_000) }))
  .handler(async ({ data: input }) => {
    const data = { id: input.id, messages: z.array(z.unknown()).max(500).parse(JSON.parse(input.messagesJson)) }
    const personId = await requirePersonId()
    const [existing] = await db.select({ personId: chatThreads.personId }).from(chatThreads).where(eq(chatThreads.id, data.id))
    if (existing && existing.personId !== personId) throw new Error('This chat belongs to someone else.')
    await db
      .insert(chatThreads)
      .values({ id: data.id, personId, title: titleFrom(data.messages), messages: data.messages })
      .onConflictDoUpdate({ target: chatThreads.id, set: { messages: data.messages, updatedAt: new Date() } })
    return { ok: true }
  })

export const renameChat = createServerFn({ method: 'POST' })
  .validator(z.object({ id: threadId, title: z.string().trim().min(1).max(80) }))
  .handler(async ({ data }) => {
    const personId = await requirePersonId()
    await db
      .update(chatThreads)
      .set({ title: data.title })
      .where(and(eq(chatThreads.id, data.id), eq(chatThreads.personId, personId)))
    return { ok: true }
  })

export const deleteChat = createServerFn({ method: 'POST' })
  .validator(z.object({ id: threadId }))
  .handler(async ({ data }) => {
    const personId = await requirePersonId()
    await db.delete(chatThreads).where(and(eq(chatThreads.id, data.id), eq(chatThreads.personId, personId)))
    return { ok: true }
  })

/** Deletes every chat of the person being viewed. */
export const deleteAllChats = createServerFn({ method: 'POST' }).handler(async () => {
  const personId = await requirePersonId()
  const gone = await db.delete(chatThreads).where(eq(chatThreads.personId, personId)).returning({ id: chatThreads.id })
  return { deleted: gone.length }
})
