import { computed, ref } from 'vue'

const RECENT_KEY = 'recent-fonts'
const MAX_RECENT = 8

const allFonts = ref<string[]>([])
const recentFonts = ref<string[]>(loadRecent())
const loading = ref(false)
let loaded = false

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') }
  catch { return [] }
}

function saveRecent() {
  localStorage.setItem(RECENT_KEY, JSON.stringify(recentFonts.value))
}

export function markFontUsed(family: string) {
  if (!family) return
  recentFonts.value = [family, ...recentFonts.value.filter(f => f !== family)].slice(0, MAX_RECENT)
  saveRecent()
}

export async function loadLocalFonts() {
  if (loaded || !('queryLocalFonts' in window)) return
  loading.value = true
  try {
    const fonts: any[] = await (window as any).queryLocalFonts()
    const set = new Set<string>()
    for (const f of fonts) set.add(f.family)
    allFonts.value = [...set].sort()
    loaded = true
  } catch {
    // permission denied
  } finally {
    loading.value = false
  }
}

const fontOptions = computed(() => {
  const opts = [{ label: '默认 (sans-serif)', value: 'sans-serif' }]
  for (const f of recentFonts.value) opts.push({ label: `★ ${f}`, value: f })
  for (const f of allFonts.value) {
    if (!recentFonts.value.includes(f)) opts.push({ label: f, value: f })
  }
  return opts
})

export function useLocalFonts() {
  return { allFonts, recentFonts, fontOptions, loading, loadLocalFonts, markFontUsed }
}
