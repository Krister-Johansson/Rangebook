// Renders the four views. Plain DOM and SVG keep the bundle small; colors
// come from CSS variables so the host theme applies.

import type { DayDetail } from '#/lib/glucose/analysis'
import type { PatternChart } from '#/lib/glucose/patterns'
import type { Actions } from './main'

type Band = 'vlow' | 'low' | 'in' | 'high' | 'vhigh'
const BAND_LABEL: Record<Band, string> = {
  vlow: 'Very low, below 3.0',
  low: 'Low, 3.0 to 3.8',
  in: 'In range, 3.9 to 10.0',
  high: 'High, 10.1 to 13.9',
  vhigh: 'Very high, above 13.9',
}
const ORDER: Band[] = ['vlow', 'low', 'in', 'high', 'vhigh']

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const color = (b: Band) => `var(--band-${b})`
const bandOf = (v: number): Band => (v < 3 ? 'vlow' : v < 3.9 ? 'low' : v <= 10 ? 'in' : v <= 13.9 ? 'high' : 'vhigh')
const perDay = (pct: number) => {
  const m = Math.round((pct / 100) * 1440)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}
const clock = (t: number) => {
  const m = Math.round(t * 60)
  return m >= 1440 ? '24:00' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function renderView(root: HTMLElement, data: { view: string } & Record<string, any>, actions: Actions) {
  if (data.view === 'week') root.innerHTML = week(data)
  else if (data.view === 'agp') root.innerHTML = agp(data)
  else if (data.view === 'patterns') {
    root.innerHTML = patterns(data)
    wirePatterns(root, data, actions)
  } else if (data.view === 'day') {
    root.innerHTML = day(data.detail, data.first_day, data.last_day)
    root.querySelectorAll<HTMLButtonElement>('[data-day]').forEach((b) =>
      b.addEventListener('click', () => actions.openDay(b.dataset.day!).catch(() => (b.disabled = true))),
    )
  } else root.innerHTML = '<p class="muted">Unknown view.</p>'
}

// ------------------------------------------------------------ week

type Summary = {
  label: string
  mean_mmol: number
  gmi_pct: number
  cv_pct: number
  sensor_wear_pct: number
  low_episodes: number
  pct: Record<string, number>
}

const pctByBand = (s: Summary): Record<Band, number> => ({
  vlow: s.pct.very_low_below_3_0,
  low: s.pct.low_3_0_to_3_8,
  in: s.pct.in_range_3_9_to_10_0,
  high: s.pct.high_10_1_to_13_9,
  vhigh: s.pct.very_high_above_13_9,
})

function tirBar(s: Summary, label: string) {
  const p = pctByBand(s)
  return `<div class="row"><span class="small" style="width:70px">${esc(label)}</span>
    <div class="bar" style="flex:1" role="img" aria-label="${esc(label)}: ${ORDER.map((b) => `${BAND_LABEL[b]} ${p[b]}%`).join(', ')}">
      ${ORDER.map((b) => `<span title="${esc(BAND_LABEL[b])}: ${p[b]}%" style="width:${p[b]}%;background:${color(b)}"></span>`).join('')}
    </div></div>`
}

function week(d: any) {
  const a: Summary = d.this_week
  const b: Summary = d.last_week
  const pa = pctByBand(a)
  const pb = pctByBand(b)
  return `
  <section class="card">
    <div class="row spread"><h1>Time in ranges</h1><span class="badge">mmol/L</span></div>
    <p><b style="font-size:24px">${perDay(pa.in)}</b> in range per day <span class="muted">(${pa.in}%, last week ${pb.in}%)</span></p>
    ${tirBar(a, 'This week')}
    ${tirBar(b, 'Last week')}
    <table><tr><th>Range</th><th class="num">This week</th><th class="num">Last week</th></tr>
      ${[...ORDER].reverse().map((k) => `<tr><td><span class="sw" style="background:${color(k)}"></span>${esc(BAND_LABEL[k])}</td><td class="num">${pa[k]}%</td><td class="num">${pb[k]}%</td></tr>`).join('')}
    </table>
    <p class="small muted">${esc(a.label)}. Clinic targets: over 70% in range, under 4% below 3.9, under 1% below 3.0.</p>
  </section>
  <section class="tiles">
    <div class="tile"><span class="small muted">Average</span><b>${a.mean_mmol}</b><span class="small muted">Last week ${b.mean_mmol}</span></div>
    <div class="tile"><span class="small muted">GMI</span><b>${a.gmi_pct}%</b><span class="small muted">Last week ${b.gmi_pct}%</span></div>
    <div class="tile"><span class="small muted">Variation (CV)</span><b>${a.cv_pct}%</b><span class="small muted">Target 36% or less</span></div>
    <div class="tile"><span class="small muted">Lows</span><b>${a.low_episodes}</b><span class="small muted">Last week ${b.low_episodes}</span></div>
  </section>
  ${d.wins?.length ? `<section class="card"><h2>Wins</h2><ul>${d.wins.map((w: string) => `<li>${esc(w)}</li>`).join('')}</ul></section>` : ''}
  <section class="card"><h2>Days</h2><table><tr><th>Day</th><th class="num">In range</th><th class="num">Below 3.9</th><th class="num">Lows</th></tr>
    ${d.days.map((x: any) => `<tr><td>${esc(x.label)}</td><td class="num">${x.sensor_wear_pct < 1 ? 'no data' : `${x.in_range_pct}%`}</td><td class="num">${x.below_3_9_pct}%</td><td class="num">${x.low_episodes}</td></tr>`).join('')}
  </table></section>`
}

// ------------------------------------------------------------ typical day

function agp(d: any) {
  const W = 640
  const H = 260
  const pad = { l: 30, r: 8, t: 10, b: 22 }
  const max = 22.2
  const x = (h: number) => pad.l + (h / 24) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - Math.min(v, max) / max) * (H - pad.t - pad.b)
  const hours = d.hours as any[]
  const pts = hours.map((h) => ({ ...h, x: x(h.hour + 0.5) }))
  const band = (lo: string, hi: string) =>
    `M${pts.map((p) => `${p.x},${y(p[hi])}`).join('L')}L${[...pts].reverse().map((p) => `${p.x},${y(p[lo])}`).join('L')}Z`
  const median = `M${pts.map((p) => `${p.x},${y(p.median)}`).join('L')}`
  const high = hours.reduce((a, h) => (h.median > a.median ? h : a))
  const low = hours.reduce((a, h) => (h.pct_below_3_9 > a.pct_below_3_9 ? h : a))
  const typeLabel = { all: 'All days', school: 'School days', weekend: 'Weekends' }[d.day_type as string]
  return `<section class="card">
    <div class="row spread"><h1>Typical day</h1><span class="badge">${esc(typeLabel)}</span></div>
    <p class="small muted">${esc(d.from)} to ${esc(d.to)}, all days laid on top of each other. mmol/L.</p>
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Typical day chart">
      <rect x="${pad.l}" y="${y(10)}" width="${W - pad.l - pad.r}" height="${y(3.9) - y(10)}" fill="var(--target-wash)"/>
      <path d="${band('p5', 'p95')}" fill="var(--agp-outer)"/>
      <path d="${band('p25', 'p75')}" fill="var(--agp-iqr)"/>
      <line x1="${pad.l}" x2="${W - pad.r}" y1="${y(10)}" y2="${y(10)}" stroke="var(--band-in)"/>
      <line x1="${pad.l}" x2="${W - pad.r}" y1="${y(3.9)}" y2="${y(3.9)}" stroke="var(--band-in)"/>
      <path d="${median}" fill="none" stroke="var(--fg)" stroke-width="2.5"/>
      ${[3.9, 10, 13.9].map((v) => `<text x="${pad.l - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('')}
      ${[0, 6, 12, 18, 24].map((h) => `<text x="${x(h)}" y="${H - 6}" text-anchor="${h === 24 ? 'end' : h === 0 ? 'start' : 'middle'}">${String(h).padStart(2, '0')}:00</text>`).join('')}
    </svg>
    <div class="legend"><span><span class="sw" style="background:var(--fg);height:3px"></span>Median</span>
      <span><span class="sw" style="background:var(--agp-iqr)"></span>Middle half (25 to 75%)</span>
      <span><span class="sw" style="background:var(--agp-outer)"></span>Most readings (5 to 95%)</span>
      <span><span class="sw" style="background:var(--band-in)"></span>Target 3.9 to 10.0</span></div>
    <p class="small">Highest median at ${clock(high.hour)} (${high.median}). Most time below 3.9 at ${clock(low.hour)} (${low.pct_below_3_9}% of readings).</p>
  </section>`
}

// ------------------------------------------------------------ patterns

function miniChart(c: PatternChart) {
  const W = 300
  const H = 90
  if (c.type === 'unitDots') {
    const dots = Array.from({ length: c.total }, (_, i) =>
      `<span class="sw" style="border-radius:50%;${i < c.filled ? `background:${color(c.band)}` : `border:1.5px solid var(--muted)`}"></span>`,
    ).join('')
    return `<div style="display:flex;flex-wrap:wrap;gap:3px;max-width:320px">${dots}</div>
      <div class="legend"><span><span class="sw" style="background:${color(c.band)};border-radius:50%"></span>${esc(c.filledLabel)}</span>
      <span><span class="sw" style="border:1.5px solid var(--muted);border-radius:50%"></span>${esc(c.emptyLabel)}</span></div>`
  }
  const rows =
    c.type === 'hourBars'
      ? c.data.map((d) => ({ hour: d.hour, vals: [d.value], hl: d.highlight }))
      : c.data.map((d) => ({ hour: d.hour, vals: [d.a, d.b], hl: false }))
  const max = Math.max(1, ...rows.flatMap((r) => r.vals), c.type === 'hourBars' ? (c.refLine?.value ?? 0) : 0)
  const slot = W / rows.length
  const y = (v: number) => H - 14 - (v / max) * (H - 24)
  const bars = rows
    .map((r, i) =>
      r.vals
        .map((v, j) => {
          const w = (slot * 0.7) / r.vals.length
          const x0 = i * slot + slot * 0.15 + j * w
          const fill = c.type === 'pairedBars' ? (j === 0 ? 'var(--agp-iqr)' : color(c.band)) : r.hl ? color(c.band) : 'var(--agp-iqr)'
          return `<rect x="${x0}" y="${y(v)}" width="${w - 1}" height="${H - 14 - y(v)}" rx="2" fill="${fill}"><title>${String(r.hour).padStart(2, '0')}:00 ${v.toFixed(1)}% ${esc(c.metric)}</title></rect>`
        })
        .join('') + `<text x="${i * slot + slot / 2}" y="${H - 2}" text-anchor="middle">${String(r.hour).padStart(2, '0')}</text>`,
    )
    .join('')
  const ref =
    c.type === 'hourBars' && c.refLine
      ? `<line x1="0" x2="${W}" y1="${y(c.refLine.value)}" y2="${y(c.refLine.value)}" stroke="var(--muted)" stroke-dasharray="3 3"/>`
      : ''
  const legend =
    c.type === 'pairedBars'
      ? `<div class="legend"><span><span class="sw" style="background:var(--agp-iqr)"></span>${esc(c.aLabel)}</span><span><span class="sw" style="background:${color(c.band)}"></span>${esc(c.bLabel)}</span></div>`
      : ''
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:420px" role="img" aria-label="${esc(c.metric)}">${bars}${ref}</svg>${legend}`
}

function patterns(d: any) {
  const saved = new Set<string>(d.saved_ids ?? [])
  const cards = (d.patterns as any[])
    .map((p) => {
      const kind = p.kind === 'low' ? 'Lows' : p.kind === 'high' ? 'Highs' : 'Routine'
      const isSaved = saved.has(p.id)
      return `<section class="card" id="${esc(p.id)}">
        <div class="row spread"><h2>${esc(p.title)}</h2><span class="badge">${kind}</span></div>
        <p class="small muted">${esc(p.when)}</p>
        <p>${esc(p.evidence)}</p>
        ${p.extra ? `<p class="muted">${esc(p.extra)}</p>` : ''}
        <p class="small strength">${[1, 2, 3].map((i) => `<i class="${i <= p.evidence_strength ? 'on' : ''}" style="height:${6 + i * 3}px"></i>`).join('')}
          ${['', 'Early sign', 'Some evidence', 'Strong evidence'][p.evidence_strength]}. <span class="muted">${esc(p.strength_note)}</span></p>
        ${miniChart(p.chart)}
        <p class="small"><span class="muted">Areas your team may look at:</span> ${p.setting_areas_for_care_team.map((t: string) => `<span class="badge">${esc(t)}</span>`).join(' ')}</p>
        <div class="question"><p class="small muted">Question for the care team</p><p>${esc(p.question_for_care_team)}</p></div>
        <div class="row"><button data-save="${esc(p.id)}" ${isSaved ? 'disabled' : ''}>${isSaved ? 'Saved for clinic' : 'Save for clinic'}</button>
          ${p.example_day ? `<button class="ghost" data-day="${esc(p.example_day)}">See an example day</button>` : ''}</div>
      </section>`
    })
    .join('')
  return `<section class="card"><h1>Patterns</h1>
    <p class="muted">${esc(d.from)} to ${esc(d.to)}. Things that happen at the same time on many days. Below 3.9: ${d.pct_below_3_9}% of readings (target under 4%).</p></section>
    ${cards || '<p class="muted">No patterns found in this period.</p>'}
    <p class="note small">These are patterns from the data, not instructions. Nothing here changes the pump. The care team decides if any setting changes.</p>`
}

function wirePatterns(root: HTMLElement, d: any, actions: Actions) {
  root.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const p = (d.patterns as any[]).find((x) => x.id === btn.dataset.save)
      if (!p) return
      btn.disabled = true
      btn.textContent = 'Saving'
      try {
        await actions.callTool('save_question_for_clinic', { question: p.question_for_care_team, pattern_id: p.id })
        btn.textContent = 'Saved for clinic'
      } catch {
        btn.disabled = false
        btn.textContent = 'Could not save, try again'
      }
    })
  })
  root.querySelectorAll<HTMLButtonElement>('[data-day]').forEach((b) =>
    b.addEventListener('click', () => actions.openDay(b.dataset.day!).catch(() => (b.disabled = true))),
  )
}

// ------------------------------------------------------------ day

function day(d: DayDetail, firstDay: string, lastDay: string) {
  const W = 640
  const H = 220
  const pad = { l: 30, r: 8, t: 10, b: 22 }
  const x = (t: number) => pad.l + (t / 24) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - Math.min(v, 22.2) / 22.2) * (H - pad.t - pad.b)
  const segs: string[] = []
  for (let i = 1; i < d.readings.length; i++) {
    const a = d.readings[i - 1]
    const b = d.readings[i]
    if (b.t - a.t > 0.2) continue
    segs.push(`<line x1="${x(a.t)}" y1="${y(a.v)}" x2="${x(b.t)}" y2="${y(b.v)}" stroke="${color(bandOf(b.v))}" stroke-width="2.2" stroke-linecap="round"/>`)
  }
  const stops = d.basal
    .filter((s) => s.suspend && s.end - s.t >= 0.25)
    .map((s) => `<rect x="${x(s.t)}" y="${pad.t}" width="${x(s.end) - x(s.t)}" height="${H - pad.t - pad.b}" fill="var(--soft)" stroke="var(--muted)" stroke-dasharray="2 2"><title>Pump stopped ${clock(s.t)} to ${clock(s.end)}</title></rect>`)
    .join('')
  const bolus = d.boluses
    .map((b) => {
      const fill = b.kind === 'carb' ? 'var(--fg)' : b.kind === 'auto' ? 'var(--agp-iqr)' : 'var(--muted)'
      const label = b.kind === 'carb' ? `${b.carbs} g carbs, ${b.units.toFixed(1)} U` : b.kind === 'auto' ? `Automatic correction (estimated), ${b.units.toFixed(1)} U` : `Bolus without carbs, ${b.units.toFixed(1)} U`
      return `<circle cx="${x(b.t)}" cy="${H - pad.b - 4}" r="${b.kind === 'carb' ? 5 : 3.5}" fill="${fill}"><title>${clock(b.t)} ${esc(label)}</title></circle>`
    })
    .join('')
  const s = d.summary
  const prev = d.prev && d.prev >= firstDay ? d.prev : null
  const next = d.next && d.next <= lastDay ? d.next : null
  return `<section class="card">
    <div class="row spread"><h1>${esc(d.label)}</h1>
      <div class="row">${prev ? `<button class="ghost" data-day="${prev}">Previous</button>` : ''}${next ? `<button class="ghost" data-day="${next}">Next</button>` : ''}</div></div>
    <div class="tiles">
      <div class="tile"><span class="small muted">In range</span><b>${s.readings ? `${s.inRange.toFixed(0)}%` : 'no data'}</b></div>
      <div class="tile"><span class="small muted">Average</span><b>${s.readings ? s.mean.toFixed(1) : 'none'}</b></div>
      <div class="tile"><span class="small muted">Lows</span><b>${s.lows}</b></div>
      <div class="tile"><span class="small muted">Sensor</span><b>${s.wear.toFixed(0)}%</b></div>
    </div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Glucose on ${esc(d.label)}">
      <rect x="${pad.l}" y="${y(10)}" width="${W - pad.l - pad.r}" height="${y(3.9) - y(10)}" fill="var(--target-wash)"/>
      ${stops}${segs.join('')}${bolus}
      ${[3.9, 10, 13.9, 22.2].map((v) => `<text x="${pad.l - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('')}
      ${[0, 6, 12, 18, 24].map((h) => `<text x="${x(h)}" y="${H - 6}" text-anchor="${h === 24 ? 'end' : h === 0 ? 'start' : 'middle'}">${String(h).padStart(2, '0')}:00</text>`).join('')}
    </svg>
    <div class="legend">${ORDER.map((b) => `<span><span class="sw" style="background:${color(b)}"></span>${BAND_LABEL[b]}</span>`).join('')}</div>
    <div class="legend"><span><span class="sw" style="background:var(--fg);border-radius:50%"></span>Bolus with carbs</span>
      <span><span class="sw" style="background:var(--agp-iqr);border-radius:50%"></span>Automatic correction (estimated)</span>
      <span><span class="sw" style="background:var(--soft);border:1px dashed var(--muted)"></span>Pump stopped</span></div>
    ${d.notes.length ? `<div class="note small"><ul>${d.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
  </section>`
}
