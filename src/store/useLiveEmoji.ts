import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { fetchRoomEmoticons } from '@/api/bili-extra'
import { getApiVtsuruClientLiveEmoji } from '@/api/generated/vtsuru/vtsuru'
import { usePersistedStorage, whenPersistedReady } from '@/shared/storage/persist'

export interface LiveEmojiData {
  inline: Record<string, string>
  plain: Record<string, string>
}

const STALE_MS = 24 * 60 * 60 * 1000
const ROOM_STALE_MS = 30 * 60 * 1000

/** B 站直播间通用表情 + 房间专属/大航海表情（`[表情名]` → 图片 URL），弹幕窗口、回放与中控台共用 */
export const useLiveEmoji = defineStore('LiveEmoji', () => {
  const emojiData = usePersistedStorage<{ updateAt: number; data: LiveEmojiData }>('Data.Emoji', {
    updateAt: 0,
    data: { inline: {}, plain: {} },
  })
  const roomEmojiMap = ref<Record<string, string>>({})
  const roomCacheMeta = new Map<number, number>()
  const inflightRoomMap = new Map<number, Promise<void>>()

  const merged = computed<Record<string, string>>(() => ({
    ...emojiData.value.data.plain,
    ...emojiData.value.data.inline,
    ...roomEmojiMap.value,
  }))

  async function refresh() {
    const resp = await getApiVtsuruClientLiveEmoji()
    if (resp.code !== 200) throw new Error(`获取表情数据失败: ${resp.message}`)
    emojiData.value = { updateAt: Date.now(), data: resp.data }
  }

  let inflightEnsure: Promise<void> | null = null

  async function ensureFresh() {
    if (inflightEnsure) return inflightEnsure
    inflightEnsure = (async () => {
      await whenPersistedReady(emojiData)
      if (emojiData.value.updateAt < Date.now() - STALE_MS) await refresh()
    })().finally(() => {
      inflightEnsure = null
    })
    return inflightEnsure
  }

  async function ensureRoomEmojis(roomId: number, force = false) {
    if (!roomId || roomId <= 0) return
    const lastAt = roomCacheMeta.get(roomId) ?? 0
    if (!force && Date.now() - lastAt < ROOM_STALE_MS) return

    const inflight = inflightRoomMap.get(roomId)
    if (inflight) return inflight

    const task = (async () => {
      try {
        const res = await fetchRoomEmoticons(roomId)
        if (res?.room && Object.keys(res.room).length > 0) {
          roomEmojiMap.value = { ...roomEmojiMap.value, ...res.room }
        }
        roomCacheMeta.set(roomId, Date.now())
      } catch (err) {
        console.warn('[LiveEmoji] 拉取房间专属表情失败:', err)
      }
    })().finally(() => {
      inflightRoomMap.delete(roomId)
    })

    inflightRoomMap.set(roomId, task)
    return task
  }

  return { emojiData, roomEmojiMap, merged, refresh, ensureFresh, ensureRoomEmojis }
})
