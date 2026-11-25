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

interface MusicRequestSnapshotPayload {
  playing?: WaitMusicInfo
  waiting?: WaitMusicInfo[]
  obsTitle?: string | null
  hideWhenEmpty?: boolean
  maxDisplayCount?: number
}

/**
 * 点歌机 OBS 展示数据，复用统一展示面板契约 (current / items / footerTags)
 */
export function useMusicRequestObsView(currentId: MaybeRefOrGetter<string | number | null | undefined>) {
  const account = useAccount()
  const playing = ref<WaitMusicInfo>()
  const waiting = ref<WaitMusicInfo[]>([])
  const remoteObsTitle = ref<string | null>(null)
  const remoteHideWhenEmpty = ref<boolean | null>(null)
  const remoteMaxDisplayCount = ref<number | null>(null)

  const isSelfContext = computed(() => {
    const validId = parsePositiveId(toValue(currentId))
    const selfId = account.value?.id && account.value.id > 0 ? String(account.value.id) : ''
    return !validId || (selfId !== '' && validId === selfId)
  })

  const title = computed(() => {
    return (
      remoteObsTitle.value?.trim() ||
      (isSelfContext.value ? account.value?.settings?.musicRequest?.obsTitle?.trim() : '') ||
      '点歌机'
    )
  })

  const hideWhenEmpty = computed(() => {
    if (remoteHideWhenEmpty.value !== null) return remoteHideWhenEmpty.value
    return isSelfContext.value ? Boolean(account.value?.settings?.musicRequest?.hideWhenEmpty) : false
  })

  const maxDisplayCount = computed(() => {
    if (remoteMaxDisplayCount.value !== null) return Math.max(0, remoteMaxDisplayCount.value)
    return isSelfContext.value ? Math.max(0, account.value?.settings?.musicRequest?.obsMaxDisplayCount ?? 0) : 0
  })

  const isEmpty = computed(() => !playing.value && waiting.value.length === 0)

  const countText = computed(() => `待播 ${waiting.value.length ?? 0} 首`)

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
    const list = maxDisplayCount.value > 0 ? waiting.value.slice(0, maxDisplayCount.value) : waiting.value
    return list.map((item, index) => ({
      id: item.requestId || (item.music.id ? `${item.music.id}-${index}` : `wait-${index}`),
      primary: item.music.name,
      secondary: item.music.author?.length ? item.music.author.join('/') : undefined,
      badges: [
        ...(item.isPinned ? [{ text: '置顶', tone: 'accent' as const }] : []),
        { text: item.from ? item.from.name : '主播添加', tone: 'default' as const },
      ],
    }))
  })

  const footerTags = computed<ObsDisplayFooterTag[]>(() => [])

  let requestSeq = 0

  function applySnapshot(snapshot: MusicRequestSnapshotPayload) {
    playing.value = snapshot.playing
    waiting.value = snapshot.waiting ?? []
    if (snapshot.obsTitle !== undefined) {
      remoteObsTitle.value = snapshot.obsTitle
    }
    if (snapshot.hideWhenEmpty !== undefined) {
      remoteHideWhenEmpty.value = Boolean(snapshot.hideWhenEmpty)
    }
    if (snapshot.maxDisplayCount !== undefined) {
      remoteMaxDisplayCount.value = Math.max(0, Number(snapshot.maxDisplayCount) || 0)
    }
  }

  async function update() {
    const seq = ++requestSeq
    const validId = parsePositiveId(toValue(currentId))
    try {
      const data = await getApiMusicRequestGetWaiting(validId ? { id: Number(validId) } : {})
      if (seq !== requestSeq) return
      if (data.code === 200 && data.data) applySnapshot(data.data)
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
    hideWhenEmpty,
    isEmpty,
    update,
    applySnapshot,
  }
}
