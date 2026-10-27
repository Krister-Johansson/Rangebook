// Pure helpers for the chat: turning answer text into blocks, finding the
// question to save, dates in the history list and error messages.

export interface Span {
  text: string
  bold: boolean
}

export type Block =
  | { type: 'p'; spans: Span[] }
  | { type: 'h'; spans: Span[] }
  | { type: 'ul'; items: Span[][] }
  | { type: 'ol'; items: Span[][] }

/** **bold** inside a line. A "**" without its pair (while streaming) is dropped. */
export function parseInline(text: string): Span[] {
  const parts = text.split('**')
  const closed = parts.length % 2 === 1
  const spans: Span[] = []
  parts.forEach((part, i) => {
    if (!part) return
    const bold = i % 2 === 1 && (closed || i < parts.length - 1)
    const last = spans[spans.length - 1]
    if (last && last.bold === bold) last.text += part
    else spans.push({ text: part, bold })
  })
  return spans
}

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const HEADING = /^\s*#{1,6}\s+(.*)$/

/**
 * Paragraphs, "- " and "1. " lists and "#" headings. Everything else stays
 * plain text: the answer is never rendered as HTML.
 */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', spans: parseInline(para.join(' ')) })
    para = []
  }
  const flushList = () => {
    if (list) blocks.push({ type: list.type, items: list.items.map(parseInline) })
    list = null
  }

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    const heading = HEADING.exec(line)
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    if (heading) {
      flushPara()
      flushList()
      blocks.push({ type: 'h', spans: parseInline(heading[1].replace(/\*\*/g, '')) })
    } else if (bullet || numbered) {
      flushPara()
      const type = bullet ? 'ul' : 'ol'
      if (list && list.type !== type) flushList()
      list ??= { type, items: [] }
      list.items.push((bullet ?? numbered)![1].trim())
    } else if (list && /^\s+/.test(raw)) {
      // An indented line continues the last list item.
      list.items[list.items.length - 1] += ` ${line.trim()}`
    } else {
      flushList()
      para.push(line.trim())
    }
  }
  flushPara()
  flushList()
  return blocks
}

/** The last sentence that ends in "?", for the Save for clinic sheet. Empty when there is none. */
export function lastQuestion(text: string): string {
  const plain = text
    .replace(/\*\*/g, '')
    .split('\n')
    .map((l) => l.replace(BULLET, '$1').replace(NUMBERED, '$1').replace(HEADING, '$1').trim())
    .join('\n')
  const sentences = plain
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (sentences[i].endsWith('?')) return sentences[i]
  }
  return ''
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** "Today", "Yesterday", "Mon", "12 Oct" or "12 Oct 2025", in local time. */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return WEEKDAYS[d.getDay()]
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? date : `${date} ${d.getFullYear()}`
}

/** A plain sentence for an error from the chat request. */
export function errorText(error: Error | undefined): string {
  if (!error) return ''
  const status = (error as { status?: number }).status ?? Number(/status:?\s*(\d{3})/i.exec(error.message)?.[1])
  if (status === 503) {
    return 'The chat is not set up on this computer yet: OPENROUTER_API_KEY is not set in .env.local. Add the key, restart the app and try again.'
  }
  if (status === 409) return 'Add a person first. The chat answers about the person selected in the app.'
  if (status === 400) return 'The app could not read that request. Try again.'
  if (status && status >= 500) return 'The chat had a problem on the server. Try again in a moment.'
  if (/failed to fetch|network|load failed/i.test(error.message)) {
    return 'Could not reach the app. Check that it is still running, then try again.'
  }
  return error.message || 'Something went wrong. Try again.'
}

/** The model's label without the note in brackets: "Claude Haiku 5.5 (faster)" becomes "Claude Haiku 5.5". */
export function modelName(label: string) {
  return label.replace(/\s*\(.*\)\s*$/, '')
}
