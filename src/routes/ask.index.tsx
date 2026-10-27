import { createFileRoute, redirect } from '@tanstack/react-router'

// /ask starts a new chat: every chat has its own id from the start.
export const Route = createFileRoute('/ask/')({
  beforeLoad: () => {
    throw redirect({ to: '/ask/$threadId', params: { threadId: crypto.randomUUID() }, replace: true })
  },
})
