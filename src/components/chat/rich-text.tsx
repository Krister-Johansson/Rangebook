import type { Block, Span } from './text'

function Spans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => (s.bold ? <strong key={i} className="font-bold">{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  )
}

/** Answer text as React elements. Never HTML. */
export function RichBlock({ block }: { block: Block }) {
  if (block.type === 'h') {
    return (
      <p className="mt-0.5 text-[13.5px] font-bold">
        <Spans spans={block.spans} />
      </p>
    )
  }
  if (block.type === 'p') {
    return (
      <p>
        <Spans spans={block.spans} />
      </p>
    )
  }
  const List = block.type === 'ul' ? 'ul' : 'ol'
  return (
    <List className={block.type === 'ul' ? '-mt-1 flex list-disc flex-col gap-1 pl-5' : '-mt-1 flex list-decimal flex-col gap-1 pl-5'}>
      {block.items.map((item, i) => (
        <li key={i}>
          <Spans spans={item} />
        </li>
      ))}
    </List>
  )
}
