import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { DanmakuUserInfo, ResponseSongModel } from '@/api/generated/model'
import { getApiMusicRequestGetWaiting } from '@/api/generated/music-request/music-request'
import type { ObsDisplayCurrent, ObsDisplayFooterTag, ObsDisplayItem } from '@/apps/obs/components/shared/obsDisplay'
import { AVATAR_URL } from '@/shared/config'
import { parsePositiveId } from '@/shared/obs/obsUrl'

interface WaitMusicInfo {
  from: DanmakuUserInfo
  music: ResponseSongModel
  requestId?: string
  isPinned?: boolean
}

/**
 * 点歌 OBS 展示数据, 复用与排队相同的展示面板契约 (current / items / footerTags),
 * 使其支持 classic / fresh / minimal 三种样式与滚动速度。
 */
export function useMusicRequestObsView(currentId: MaybeRefOrGetter<string | number | null | undefined>) {
  const account = useAccount()
  const playing = ref<WaitMusicInfo>()
  const waiting = ref<WaitMusicInfo[]>([])

  const title = computed(() => {
    const validId = parsePositiveId(toValue(currentId))
    const selfId = account.value?.id && account.value.id > 0 ? String(account.value.id) : ''
    const isSelfContext = !validId || (selfId !== '' && validId === selfId)
    return (isSelfContext ? account.value?.settings?.musicRequest?.obsTitle?.trim() : '') || '点歌机'
  })
  const countText = computed(() => `已有 ${waiting.value.length ?? 0} 首`)

  const current = computed<ObsDisplayCurrent>(() => {
    if (!playing.value) {
      return { active: false, emptyText: '暂无点歌' }
    }
    return {
      active: true,
      title: playing.value.music.name,
      subtitle: playing.value.from?.name ?? '主播添加',
      avatarUrl:
        playing.value.music.cover ?? (playing.value.from?.uid ? AVATAR_URL + playing.value.from.uid : undefined),
      emptyText: '暂无点歌',
      badges: playing.value.music.author?.length ? [{ text: playing.value.music.author.join('/'), tone: 'muted' }] : [],
    }
  })

  const items = computed<ObsDisplayItem[]>(() => {
    return waiting.value.map((item, index) => ({
      id: item.requestId || (item.music.id ? `${item.music.id}-${index}` : `wait-${index}`),
      primary: item.music.name,
      badges: [
        ...(item.isPinned ? [{ text: '置顶', tone: 'accent' as const }] : []),
        { text: item.from ? item.from.name : '主播添加', tone: 'default' as const },
      ],
    }))
  })

  const footerTags = computed<ObsDisplayFooterTag[]>(() => [])

  let requestSeq = 0

  function applySnapshot(snapshot: { playing?: WaitMusicInfo; waiting?: WaitMusicInfo[] }) {
    playing.value = snapshot.playing
    waiting.value = snapshot.waiting ?? []
  }

  async function update() {
    const seq = ++requestSeq
    const validId = parsePositiveId(toValue(currentId))
    try {
      const data = await getApiMusicRequestGetWaiting(validId ? { id: Number(validId) } : {})
      if (seq !== requestSeq) return
      if (data.code === 200) applySnapshot(data.data)
    } catch (err) {
      if (seq === requestSeq) {
        console.error('[MUSIC-REQUEST-OBS] 获取点歌队列失败', err)
      }
    }
  }

  watch(
    () => toValue(currentId),
    () => {
      void update()
    },
  )

  return {
    playing,
    waiting,
    title,
    countText,
    current,
    items,
    footerTags,
    update,
    applySnapshot,
  }
}
