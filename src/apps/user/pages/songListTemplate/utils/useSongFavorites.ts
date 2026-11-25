import { computed, type MaybeRefOrGetter, toValue } from 'vue'

import { usePersistedStorage } from '@/shared/storage/persist'

const FAVORITES_STORAGE_KEY = 'SongList.FavoritesByOwner'
const MAX_OWNERS = 80

const favoritesByOwner = usePersistedStorage<Record<string, string[]>>(FAVORITES_STORAGE_KEY, {})

function normalizeOwnerKey(ownerId: number | string | null | undefined): string | null {
  if (ownerId === null || ownerId === undefined || ownerId === '' || ownerId === 0) return null
  return String(ownerId)
}

export function useSongFavorites(ownerId: MaybeRefOrGetter<number | string | null | undefined>) {
  const ownerKey = computed(() => normalizeOwnerKey(toValue(ownerId)))

  const favoriteKeyList = computed<string[]>(() => {
    const key = ownerKey.value
    if (!key) return []
    const stored = favoritesByOwner.value?.[key]
    return Array.isArray(stored) ? stored : []
  })

  const favoriteKeys = computed(() => new Set(favoriteKeyList.value))
  const favoriteCount = computed(() => favoriteKeys.value.size)

  function isFavorite(songKey: string): boolean {
    return favoriteKeys.value.has(songKey)
  }

  function toggleFavorite(songKey: string): boolean {
    const key = ownerKey.value
    if (!key || !songKey) return false
    const current = new Set(favoriteKeyList.value)
    let added = false
    if (current.has(songKey)) {
      current.delete(songKey)
    } else {
      current.add(songKey)
      added = true
    }

    const nextMap: Record<string, string[]> = { ...favoritesByOwner.value }
    if (current.size === 0) {
      delete nextMap[key]
    } else {
      nextMap[key] = [...current]
    }

    const keys = Object.keys(nextMap)
    if (keys.length > MAX_OWNERS) {
      for (const staleKey of keys.slice(0, keys.length - MAX_OWNERS)) {
        delete nextMap[staleKey]
      }
    }

    favoritesByOwner.value = nextMap
    return added
  }

  return {
    favoriteKeys,
    favoriteCount,
    isFavorite,
    toggleFavorite,
  }
}
