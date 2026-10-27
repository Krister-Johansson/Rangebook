import { FileArchive, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

const ACCEPT = ['.zip', '.csv']

export function isAcceptedFile(f: File) {
  return ACCEPT.some((ext) => f.name.toLowerCase().endsWith(ext))
}

function formatSize(bytes: number) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function DropZone({
  files,
  onChange,
  disabled,
}: {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const add = (list: FileList | null) => {
    if (!list) return
    const next = [...files]
    for (const f of Array.from(list)) {
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f)
    }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!disabled) add(e.dataTransfer.files)
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
          'hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-2',
          dragging && 'border-primary bg-primary/5',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <Upload className="size-8 text-muted-foreground" />
        <span className="font-medium">Drop the export zip here</span>
        <span className="text-sm text-muted-foreground">
          or click to choose a file. Loose CSV files from the export also work.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(',')}
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files)
          e.target.value = ''
        }}
      />
      {files.length > 0 && (
        <ul className="divide-y rounded-md border">
          {files.map((f) => (
            <li
              key={`${f.name}-${f.size}`}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <FileArchive className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-muted-foreground">{formatSize(f.size)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={disabled}
                onClick={() => onChange(files.filter((x) => x !== f))}
                aria-label={`Remove ${f.name}`}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
