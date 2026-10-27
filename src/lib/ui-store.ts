import { Store } from '@tanstack/store'

export type Theme = 'light' | 'dark' | 'system'

export interface UiState {
  theme: Theme
  stripes: boolean
}

const KEY = 'cgm-ui'

function read(): UiState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { theme: 'system', stripes: false, ...JSON.parse(raw) }
  } catch {
    // Private mode or blocked storage: fall back to defaults.
  }
  return { theme: 'system', stripes: false }
}

// Per-browser display settings. Kept out of Postgres on purpose: they belong
// to the device, not to the data.
export const uiStore = new Store<UiState>(
  typeof window === 'undefined' ? { theme: 'system', stripes: false } : read(),
)

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Browser chrome color (status bar on phones), matching --background.
export const THEME_COLORS = { light: '#ffffff', dark: '#09090b' }

export function applyUi(state: UiState) {
  const el = document.documentElement
  const dark = state.theme === 'dark' || (state.theme === 'system' && systemDark())
  // Switch without the 150 ms color transitions on rows and buttons, so the
  // whole page changes at once instead of in a staggered fade.
  const freeze = document.createElement('style')
  freeze.textContent = '*,*::before,*::after{transition:none!important}'
  document.head.appendChild(freeze)
  el.classList.toggle('dark', dark)
  el.classList.toggle('stripes', state.stripes)
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light)
  void getComputedStyle(document.body).opacity
  requestAnimationFrame(() => freeze.remove())
}

if (typeof window !== 'undefined') {
  uiStore.subscribe(() => {
    applyUi(uiStore.state)
    try {
      localStorage.setItem(KEY, JSON.stringify(uiStore.state))
    } catch {
      // ignore
    }
  })
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => applyUi(uiStore.state))
}

export const setTheme = (theme: Theme) => uiStore.setState((s) => ({ ...s, theme }))
export const setStripes = (stripes: boolean) => uiStore.setState((s) => ({ ...s, stripes }))

/** Inline script for <head> so the first paint already has the right theme. */
export const themeBootScript = `(function(){try{var s=JSON.parse(localStorage.getItem('${KEY}')||'{}');var t=s.theme||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var c=document.documentElement.classList;if(d)c.add('dark');if(s.stripes)c.add('stripes');var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',d?'#09090b':'#ffffff')}catch(e){}})()`
