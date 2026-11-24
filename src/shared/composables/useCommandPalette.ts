import type { Component } from 'vue'
import { computed, ref, shallowRef } from 'vue'

import { usePersistedStorage } from '@/shared/storage/persist'

export type CommandScope = 'client' | 'dynamic' | 'manage' | 'docs'

export type CommandItem = {
  id: string
  group: string
  label: string
  description?: string
  keywords: string[]
  icon: Component
  shortcut?: string
  badge?: string
  scope?: CommandScope
  run: () => void | Promise<unknown>
}

export type DynamicCommandSource = () => CommandItem[]

const open = ref(false)
const sources = shallowRef<Map<string, DynamicCommandSource>>(new Map())
const recentIds = usePersistedStorage<string[]>('Settings.CommandPaletteRecent', [])

const MAX_RECENT_ITEMS = 6

export function useCommandPalette() {
  const dynamicItems = computed<CommandItem[]>(() => {
    const items: CommandItem[] = []
    for (const getter of sources.value.values()) {
      items.push(...getter())
    }
    return items
  })

  function registerSource(id: string, getter: DynamicCommandSource) {
    const next = new Map(sources.value)
    next.set(id, getter)
    sources.value = next
    return () => {
      const cleaned = new Map(sources.value)
      if (cleaned.get(id) === getter) {
        cleaned.delete(id)
        sources.value = cleaned
      }
    }
  }

  function recordRecent(id: string) {
    const list = Array.isArray(recentIds.value) ? recentIds.value : []
    recentIds.value = [id, ...list.filter((item) => item !== id)].slice(0, MAX_RECENT_ITEMS)
  }

  return {
    open,
    dynamicItems,
    recentIds,
    openPalette: () => {
      open.value = true
    },
    closePalette: () => {
      open.value = false
    },
    togglePalette: () => {
      open.value = !open.value
    },
    registerSource,
    recordRecent,
  }
}
