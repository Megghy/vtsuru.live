import type {
  DanmakuUserInfo,
  SongsInfo,
} from '@/api/api-models'
import type {
  ObsDisplayCurrent,
  ObsDisplayFooterTag,
  ObsDisplayItem,
} from '@/apps/obs/components/shared/obsDisplay'
import { computed, ref } from 'vue'
import { QueryGetAPI } from '@/api/query'
import { AVATAR_URL, MUSIC_REQUEST_API_URL } from '@/shared/config'

interface WaitMusicInfo {
  from: DanmakuUserInfo
  music: SongsInfo
}

/**
 * 点歌 OBS 展示数据, 复用与排队相同的展示面板契约 (current / items / footerTags),
 * 使其支持 classic / fresh / minimal 三种样式与滚动速度。
 */
export function useMusicRequestObsView(currentId: string) {
  const playing = ref<WaitMusicInfo>()
  const waiting = ref<WaitMusicInfo[]>([])

  const title = computed(() => '点歌')
  const countText = computed(() => `已有 ${waiting.value.length ?? 0} 首`)

  const current = computed<ObsDisplayCurrent>(() => {
    if (!playing.value) {
      return { active: false, emptyText: '暂无点歌' }
    }
    return {
      active: true,
      title: playing.value.music.name,
      subtitle: playing.value.from?.name ?? '主播添加',
      avatarUrl: playing.value.music.cover ?? (playing.value.from?.uid ? AVATAR_URL + playing.value.from.uid : undefined),
      emptyText: '暂无点歌',
      badges: playing.value.music.author?.length
        ? [{ text: playing.value.music.author.join('/'), tone: 'muted' }]
        : [],
    }
  })

  const items = computed<ObsDisplayItem[]>(() => {
    return waiting.value.map((item, index) => ({
      id: item.music.id ?? index,
      primary: item.music.name,
      badges: [{ text: item.from ? item.from.name : '主播添加', tone: 'default' as const }],
    }))
  })

  const footerTags = computed<ObsDisplayFooterTag[]>(() => [])

  async function get() {
    try {
      const data = await QueryGetAPI<{ playing?: WaitMusicInfo, waiting: WaitMusicInfo[] }>(
        `${MUSIC_REQUEST_API_URL}get-waiting`,
        { id: currentId },
      )
      if (data.code === 200) return data.data
    } catch (err) {
      console.error('[MUSIC-REQUEST-OBS] 获取点歌队列失败', err)
    }
    return { playing: playing.value, waiting: waiting.value }
  }

  async function update() {
    const result = await get()
    playing.value = result.playing
    waiting.value = result.waiting ?? []
  }

  return {
    playing,
    waiting,
    title,
    countText,
    current,
    items,
    footerTags,
    update,
  }
}
