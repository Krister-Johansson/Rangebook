import { cn } from '#/lib/utils'

// A small round sprout creature. It grows a little at each stage (seed,
// sprout, sapling, bud, bloom) and has four moods. It never reacts to
// glucose values: moods come from imports, levels and challenges only.

export const PET_COLORS = [
  { id: 'sky', label: 'Sky', body: 'oklch(0.8 0.09 235)', leaf: 'oklch(0.62 0.11 200)' },
  { id: 'lilac', label: 'Lilac', body: 'oklch(0.8 0.09 305)', leaf: 'oklch(0.6 0.11 280)' },
  { id: 'coral', label: 'Coral', body: 'oklch(0.8 0.1 15)', leaf: 'oklch(0.6 0.12 355)' },
  { id: 'teal', label: 'Teal', body: 'oklch(0.8 0.08 190)', leaf: 'oklch(0.58 0.09 175)' },
  { id: 'sun', label: 'Sun', body: 'oklch(0.89 0.09 95)', leaf: 'oklch(0.64 0.1 75)' },
] as const

export type PetColor = (typeof PET_COLORS)[number]['id']
export type PetMood = 'happy' | 'curious' | 'celebrating' | 'sleepy'

export function petColor(id: string) {
  return PET_COLORS.find((c) => c.id === id) ?? PET_COLORS[0]
}

const INK = 'oklch(0.25 0.02 260)'

export function CompanionSvg({
  stage = 4,
  mood = 'happy',
  color = 'sky',
  size = 96,
  still = false,
  className,
}: {
  stage?: number
  mood?: PetMood
  color?: string
  size?: number
  still?: boolean
  className?: string
}) {
  const c = petColor(color)
  const s = [0, 0.78, 0.86, 0.93, 1, 1.04][Math.min(5, Math.max(1, stage))]
  const rx = 34 * s
  const ry = 30 * s
  const cy = 76
  const top = cy - ry
  const sleepy = mood === 'sleepy'
  const party = mood === 'celebrating'
  const curious = mood === 'curious'
  const ex = 12 * s
  const ey = cy - 4 * s
  const leaf = (rot: number, len: number) => (
    <ellipse cx={60} cy={top - len / 2} rx={5.5} ry={len / 2} fill={c.leaf} transform={`rotate(${rot} 60 ${top})`} />
  )

  return (
    <svg
      className={cn('block overflow-visible', !still && 'pet-anim', `pet-${mood}`, className)}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      {party ? (
        <g>
          <rect x="14" y="30" width="7" height="7" rx="1" transform="rotate(45 17.5 33.5)" fill={c.leaf} />
          <rect x="98" y="24" width="6" height="6" rx="1" transform="rotate(45 101 27)" fill={c.leaf} />
          <rect x="102" y="62" width="5" height="5" rx="1" transform="rotate(45 104.5 64.5)" fill={c.body} />
          <circle cx="22" cy="64" r="2.5" fill={c.body} />
        </g>
      ) : null}
      <g transform={curious ? 'rotate(-7 60 90)' : undefined}>
        <g transform={sleepy ? `rotate(22 60 ${top})` : undefined}>
          <path d={`M60 ${top + 2} V${top - (stage >= 3 ? 14 : 9)}`} stroke={c.leaf} strokeWidth="3" strokeLinecap="round" />
          {leaf(-48, stage >= 2 ? 18 : 14)}
          {stage >= 2 ? leaf(48, stage >= 3 ? 18 : 14) : null}
          {stage === 4 ? <circle cx="60" cy={top - 16} r="5" fill={c.body} stroke={c.leaf} strokeWidth="2" /> : null}
          {stage >= 5 ? (
            <g>
              {[0, 72, 144, 216, 288].map((a) => (
                <circle
                  key={a}
                  cx={60 + Math.cos(((a - 90) * Math.PI) / 180) * 6}
                  cy={top - 18 + Math.sin(((a - 90) * Math.PI) / 180) * 6}
                  r="4.5"
                  fill={c.body}
                  stroke={c.leaf}
                  strokeWidth="1.5"
                />
              ))}
              <circle cx="60" cy={top - 18} r="3.5" fill={c.leaf} />
            </g>
          ) : null}
        </g>
        {stage >= 3 ? (
          <g stroke={c.leaf} strokeWidth="5" strokeLinecap="round">
            {party ? (
              <>
                <path d={`M${60 - rx + 4} ${cy - 4} L${60 - rx - 8} ${cy - 20}`} />
                <path d={`M${60 + rx - 4} ${cy - 4} L${60 + rx + 8} ${cy - 20}`} />
              </>
            ) : (
              <>
                <path d={`M${60 - rx + 3} ${cy + 4} L${60 - rx - 6} ${cy + 12}`} />
                <path d={`M${60 + rx - 3} ${cy + 4} L${60 + rx + 6} ${cy + 12}`} />
              </>
            )}
          </g>
        ) : null}
        <ellipse cx={60 - 13 * s} cy={cy + ry - 2} rx={8 * s} ry={5} fill={c.leaf} />
        <ellipse cx={60 + 13 * s} cy={cy + ry - 2} rx={8 * s} ry={5} fill={c.leaf} />
        <ellipse cx="60" cy={cy} rx={rx} ry={ry} fill={c.body} />
        <ellipse cx={60 - rx * 0.35} cy={cy - ry * 0.45} rx={rx * 0.28} ry={ry * 0.16} fill="#ffffff" opacity="0.35" />
        <ellipse cx={60 - ex - 7} cy={ey + 9} rx="5" ry="3" fill="oklch(0.72 0.12 15)" opacity="0.35" />
        <ellipse cx={60 + ex + 7} cy={ey + 9} rx="5" ry="3" fill="oklch(0.72 0.12 15)" opacity="0.35" />
        {sleepy ? (
          <g stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none">
            <path d={`M${60 - ex - 4} ${ey} q4 3 8 0`} />
            <path d={`M${60 + ex - 4} ${ey} q4 3 8 0`} />
          </g>
        ) : party ? (
          <g stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none">
            <path d={`M${60 - ex - 4} ${ey + 1} q4 -5 8 0`} />
            <path d={`M${60 + ex - 4} ${ey + 1} q4 -5 8 0`} />
          </g>
        ) : (
          <g>
            <circle cx={60 - ex} cy={ey} r="4.6" fill={INK} />
            <circle cx={60 + ex} cy={ey} r="4.6" fill={INK} />
            <circle cx={60 - ex + (curious ? 2 : 1.4)} cy={ey - (curious ? 2 : 1.4)} r="1.5" fill="#ffffff" />
            <circle cx={60 + ex + (curious ? 2 : 1.4)} cy={ey - (curious ? 2 : 1.4)} r="1.5" fill="#ffffff" />
          </g>
        )}
        {party ? (
          <path d={`M54 ${ey + 8} q6 8 12 0 z`} fill={INK} />
        ) : curious ? (
          <circle cx="60" cy={ey + 11} r="2.6" fill="none" stroke={INK} strokeWidth="2" />
        ) : sleepy ? (
          <path d={`M57 ${ey + 11} q3 1.5 6 0`} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : (
          <path d={`M55 ${ey + 8} q5 5 10 0`} stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        )}
      </g>
      {sleepy ? (
        <g fill={c.leaf} fontWeight="800">
          <text x="88" y="40" fontSize="14">
            z
          </text>
          <text x="98" y="28" fontSize="10">
            z
          </text>
        </g>
      ) : null}
    </svg>
  )
}
