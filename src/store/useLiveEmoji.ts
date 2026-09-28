import { defineStore } from 'pinia'
import { computed } from 'vue'

import { QueryGetAPI } from '@/api/query'
import { VTSURU_API_URL } from '@/shared/config'
import { usePersistedStorage, whenPersistedReady } from '@/shared/storage/persist'

export interface LiveEmojiData {
  inline: Record<string, string>
  plain: Record<string, string>
}

const STALE_MS = 24 * 60 * 60 * 1000

/** B 站直播间通用表情（`[表情名]` → 图片 URL），弹幕窗口与中控台共用 */
export const useLiveEmoji = defineStore('LiveEmoji', () => {
  const emojiData = usePersistedStorage<{ updateAt: number; data: LiveEmojiData }>('Data.Emoji', {
    updateAt: 0,
    data: { inline: {}, plain: {} },
  })
  const merged = computed<Record<string, string>>(() => ({ ...emojiData.value.data.plain, ...emojiData.value.data.inline }))

  async function refresh() {
    const resp = await QueryGetAPI<LiveEmojiData>(`${VTSURU_API_URL}client/live-emoji`)
    if (resp.code !== 200) throw new Error(`获取表情数据失败: ${resp.message}`)
    emojiData.value = { updateAt: Date.now(), data: resp.data }
  }

  async function ensureFresh() {
    await whenPersistedReady(emojiData)
    if (emojiData.value.updateAt < Date.now() - STALE_MS) await refresh()
  }

  return { emojiData, merged, refresh, ensureFresh }
})
