import type { SongRequestInfo } from '@/api/api-models'
import { SongRequestStatus } from '@/api/api-models'
import { computed } from 'vue'

export function useLiveRequestStatus(source: () => SongRequestInfo[] | undefined) {
  const active = computed(() => {
    const set = new Set<string>()
    source()?.forEach((item) => {
      if (item.song?.key) set.add(item.song.key)
    })
    return set
  })

  const singing = computed(() => {
    const set = new Set<string>()
    source()?.forEach((item) => {
      if (item.status === SongRequestStatus.Singing && item.song?.key) {
        set.add(item.song.key)
      }
    })
    return set
  })

  const queued = computed(() => {
    const set = new Set<string>()
    source()?.forEach((item) => {
      if (item.status !== SongRequestStatus.Singing && item.song?.key) {
        set.add(item.song.key)
      }
    })
    return set
  })

  return { active, singing, queued }
}
