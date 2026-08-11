import { computed, onScopeDispose, ref, watch, type MaybeRefOrGetter, toValue } from 'vue'

import { useAccount } from '@/api/account'
import type { SongRequestInfo, SongsInfo, UserInfo } from '@/api/api-models'
import { useBiliAuth } from '@/store/useBiliAuth'

import { useLiveRequestStatus } from './useLiveRequestStatus'

export interface SongListTemplateCoreOptions {
  userInfo: MaybeRefOrGetter<UserInfo | undefined>
  liveRequestActive?: MaybeRefOrGetter<SongRequestInfo[] | undefined>
  /** 点歌 loading 自动清除时长，默认 2000ms */
  requestLoadingMs?: number
}

export function useSongListTemplateCore(options: SongListTemplateCoreOptions) {
  const accountInfo = useAccount()
  const biliAuth = useBiliAuth()
  const requestingKey = ref('')
  let requestTimer: ReturnType<typeof setTimeout> | undefined

  const requestAuthState = computed(() => ({
    isLoggedIn: !!accountInfo.value.id,
    isBiliAuthed: biliAuth.isAuthed,
  }))

  const isSelf = computed(() => {
    const user = toValue(options.userInfo)
    return !!user?.id && accountInfo.value?.id === user.id
  })

  const { active, singing, queued } = useLiveRequestStatus(() => toValue(options.liveRequestActive))

  function clearRequestTimer() {
    if (!requestTimer) return
    clearTimeout(requestTimer)
    requestTimer = undefined
  }

  function beginRequest(song: SongsInfo) {
    if (isSelf.value) return false
    requestingKey.value = song.key
    clearRequestTimer()
    requestTimer = setTimeout(() => {
      requestingKey.value = ''
      requestTimer = undefined
    }, options.requestLoadingMs ?? 2000)
    return true
  }

  function isRequesting(songKey: string) {
    return requestingKey.value === songKey
  }

  onScopeDispose(clearRequestTimer)

  return {
    requestAuthState,
    isSelf,
    requestingKey,
    activeSongKeys: active,
    singingSongKeys: singing,
    queuedSongKeys: queued,
    beginRequest,
    isRequesting,
  }
}

/** 标签/作者切换时递增 epoch 供入场动画；搜索输入不触发 */
export function useFilterListKey(sources: {
  tag?: MaybeRefOrGetter<string | null | undefined>
  author?: MaybeRefOrGetter<string | null | undefined>
  language?: MaybeRefOrGetter<string | null | undefined>
  /** 仅在提交搜索后变化的 keyword（非输入框即时值） */
  committedKeyword?: MaybeRefOrGetter<string | null | undefined>
}) {
  const filterEpoch = ref(0)

  watch(
    () => [
      toValue(sources.tag) ?? null,
      toValue(sources.author) ?? null,
      toValue(sources.language) ?? null,
      toValue(sources.committedKeyword) ?? '',
    ],
    () => {
      filterEpoch.value += 1
    },
  )

  const listKey = computed(
    () =>
      `${toValue(sources.tag) ?? 'all'}:${toValue(sources.author) ?? 'all'}:${toValue(sources.language) ?? 'all'}:${toValue(sources.committedKeyword) ?? ''}:${filterEpoch.value}`,
  )

  return { filterEpoch, listKey }
}

export type SongRequestAuthState = {
  isLoggedIn: boolean
  isBiliAuthed: boolean
}
