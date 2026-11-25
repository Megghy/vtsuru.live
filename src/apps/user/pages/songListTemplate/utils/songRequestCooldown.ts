import { computed, type MaybeRefOrGetter, toValue } from 'vue'

import { usePersistedStorage } from '@/shared/storage/persist'

const COOLDOWN_STORAGE_KEY = 'SongList.NextRequestTimeByOwner'
const DEFAULT_COOLDOWN_SECONDS = 30

const cooldownMap = usePersistedStorage<Record<string, number>>(COOLDOWN_STORAGE_KEY, {})

function normalizeOwnerKey(ownerId: number | string | null | undefined): string {
  return ownerId ? String(ownerId) : 'global'
}

function pruneExpiredCooldowns(source: Record<string, number>, nowMs: number): Record<string, number> {
  const next: Record<string, number> = {}
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > nowMs) {
      next[key] = value
    }
  }
  return next
}

export function getSongRequestCooldownMs(ownerId: number | string | null | undefined): number | undefined {
  const key = normalizeOwnerKey(ownerId)
  const target = cooldownMap.value?.[key]
  return typeof target === 'number' && Number.isFinite(target) ? target : undefined
}

export function setSongRequestCooldown(
  ownerId: number | string | null | undefined,
  seconds = DEFAULT_COOLDOWN_SECONDS,
): number {
  const nowMs = Date.now()
  const nextMs = nowMs + seconds * 1000
  const pruned = pruneExpiredCooldowns(cooldownMap.value ?? {}, nowMs)
  pruned[normalizeOwnerKey(ownerId)] = nextMs
  cooldownMap.value = pruned
  return nextMs
}

export function useSongRequestCooldown(ownerId: MaybeRefOrGetter<number | string | null | undefined>) {
  const nextRequestTimeMs = computed(() => getSongRequestCooldownMs(toValue(ownerId)))

  function markRequested(seconds = DEFAULT_COOLDOWN_SECONDS) {
    return setSongRequestCooldown(toValue(ownerId), seconds)
  }

  return {
    nextRequestTimeMs,
    markRequested,
  }
}
