// The agent loop stores one assistant message per model turn: the tool calls
// in one, the written answer in the next. The thread shows them as one answer.

interface MessageLike<P> {
  id: string
  role: string
  parts: ReadonlyArray<P>
}

/** Consecutive assistant messages merged into one, keeping the first id. System messages are left out. */
export function groupTurns<P, M extends MessageLike<P>>(messages: ReadonlyArray<M>): M[] {
  const out: M[] = []
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    const prev = out[out.length - 1]
    if (m.role === 'assistant' && prev?.role === 'assistant') {
      out[out.length - 1] = { ...prev, parts: [...prev.parts, ...m.parts] }
    } else {
      out.push(m)
    }
  }
  return out
}
