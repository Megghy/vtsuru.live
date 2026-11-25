import { computed, ref, type MaybeRefOrGetter, toValue } from 'vue'

import { useAccount } from '@/api/account'
import type { SongRequestInfo } from '@/api/client-types'
import {
  postApiLiveRequestAddFromWeb,
  postApiLiveRequestPriorityFromWeb,
} from '@/api/generated/live-request/live-request'
import type { ResponseSongModel, ResponseUserInfo, SettingSongRequest } from '@/api/generated/model'
import { SongRequestStatus } from '@/api/generated/model'
import { postApiLiveRequestCancelFromWeb } from '@/api/songRequestExtras'
import { copyToClipboard, useMessage } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import { useSongRequestCooldown } from './songRequestCooldown'
import { canRequestSong } from './songRequestUtils'

export interface UseSongRequestFlowOptions {
  userInfo: MaybeRefOrGetter<ResponseUserInfo | undefined>
  settings: MaybeRefOrGetter<SettingSongRequest | undefined>
  songsActive?: MaybeRefOrGetter<SongRequestInfo[] | undefined>
  onActiveUpdated?: () => Promise<void> | void
}

export function useSongRequestFlow(options: UseSongRequestFlowOptions) {
  const accountInfo = useAccount()
  const biliAuth = useBiliAuth()
  const message = useMessage()

  const ownerId = computed(() => toValue(options.userInfo)?.id)
  const isLoggedIn = computed(() => Boolean(accountInfo.value.id))
  const { nextRequestTimeMs, markRequested } = useSongRequestCooldown(ownerId)

  const userPoints = ref<number | null>(null)
  const pendingSong = ref<ResponseSongModel | null>(null)
  const usePriorityOnRequest = ref(false)
  const isSubmittingRequest = ref(false)
  const prioritizingId = ref<number | null>(null)
  const cancellingId = ref<number | null>(null)

  const currentSettings = computed(() => toValue(options.settings))

  const hasPointFeatures = computed(
    () =>
      Boolean(currentSettings.value?.allowFromWeb) &&
      ((Boolean(currentSettings.value?.enablePointRequest) && (currentSettings.value?.pointRequestCost ?? 0) > 0) ||
        Boolean(currentSettings.value?.allowPointPriority)),
  )

  const basePointCost = computed(() =>
    currentSettings.value?.enablePointRequest ? Math.max(0, currentSettings.value.pointRequestCost ?? 0) : 0,
  )

  const priorityPointCost = computed(() =>
    currentSettings.value?.allowPointPriority ? Math.max(0, currentSettings.value.pointPriorityCost ?? 0) : 0,
  )

  const totalPendingPointCost = computed(
    () => basePointCost.value + (usePriorityOnRequest.value ? priorityPointCost.value : 0),
  )

  const myWaitingSongs = computed(() => {
    const uid = biliAuth.biliAuth?.userId
    const active = toValue(options.songsActive) ?? []
    if (!uid) return []
    return active.filter(
      (item) => item.status === SongRequestStatus.Waiting && item.user?.uid && item.user.uid === uid,
    )
  })

  async function refreshUserPoints() {
    if (!ownerId.value || !biliAuth.isAuthed) {
      userPoints.value = null
      return
    }
    const pts = await biliAuth.GetSpecificPoint(ownerId.value)
    userPoints.value = typeof pts === 'number' ? pts : null
  }

  function getDanmakuCommand(song: ResponseSongModel): string {
    return `${currentSettings.value?.orderPrefix || ''} ${song.name}`.trim()
  }

  function checkSongRequestable(song: ResponseSongModel) {
    return canRequestSong(
      song,
      toValue(options.userInfo),
      currentSettings.value,
      isLoggedIn.value,
      biliAuth.isAuthed,
      nextRequestTimeMs.value,
    )
  }

  async function requestSong(song: ResponseSongModel) {
    const orderText = getDanmakuCommand(song)
    const check = checkSongRequestable(song)

    if (check.shouldCopyOnly) {
      await copyToClipboard(orderText, false)
      message.info(check.reason)
      return
    }

    if (!check.canRequest) {
      message.warning(check.reason)
      return
    }

    pendingSong.value = song
    usePriorityOnRequest.value = false
    if (basePointCost.value > 0 || currentSettings.value?.allowPointPriority) {
      void refreshUserPoints()
    }
  }

  async function submitWebSongRequest(song: ResponseSongModel, usePriority: boolean) {
    if (!ownerId.value || isSubmittingRequest.value) return
    const needPoints = basePointCost.value + (usePriority ? priorityPointCost.value : 0)
    if (needPoints > 0 && !biliAuth.isAuthed) {
      message.warning('使用积分点歌或插队需要先绑定 B 站账号')
      return
    }

    isSubmittingRequest.value = true
    try {
      const data = await postApiLiveRequestAddFromWeb(
        {
          target: ownerId.value,
          song: song.key,
          usePriority,
        },
        biliAuth.isAuthed ? { headers: Object.fromEntries(await biliAuth.getBiliAuthHeaders()) } : undefined,
      )

      if (data.code === 200) {
        message.success(usePriority ? '积分点歌并插队成功' : '点歌成功')
        pendingSong.value = null
        const cooldownSeconds =
          currentSettings.value?.enableWebCooldown && (currentSettings.value.webCooldownSecond ?? 0) > 0
            ? currentSettings.value.webCooldownSecond
            : 30
        markRequested(cooldownSeconds)
        await options.onActiveUpdated?.()
        await refreshUserPoints()
      } else {
        message.error(`点歌失败: ${data.message}`)
      }
    } catch (err) {
      console.error('点歌出错:', err)
      message.error(`点歌失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      isSubmittingRequest.value = false
    }
  }

  async function priorityExistingSong(item: SongRequestInfo) {
    if (!ownerId.value || prioritizingId.value === item.id) return
    if (!biliAuth.isAuthed) {
      message.warning('积分插队需要先绑定 B 站账号')
      return
    }
    prioritizingId.value = item.id
    try {
      const data = await postApiLiveRequestPriorityFromWeb(
        { target: ownerId.value, id: item.id },
        { headers: Object.fromEntries(await biliAuth.getBiliAuthHeaders()) },
      )
      if (data.code === 200) {
        message.success(`已为《${item.songName}》使用积分插队`)
        await options.onActiveUpdated?.()
        await refreshUserPoints()
      } else {
        message.error(`插队失败: ${data.message}`)
      }
    } catch (err) {
      message.error(`插队失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      prioritizingId.value = null
    }
  }

  async function cancelExistingSong(item: SongRequestInfo) {
    if (!ownerId.value || cancellingId.value === item.id) return
    if (!biliAuth.isAuthed) {
      message.warning('撤回点歌需要先绑定 B 站账号')
      return
    }
    cancellingId.value = item.id
    try {
      const data = await postApiLiveRequestCancelFromWeb(
        { target: ownerId.value, id: item.id },
        { headers: Object.fromEntries(await biliAuth.getBiliAuthHeaders()) },
      )
      if (data.code === 200) {
        const refunded = data.data?.pointRefunded && (data.data?.refundedAmount ?? 0) > 0
        message.success(
          refunded
            ? `已撤回《${item.songName}》，退回 ${data.data.refundedAmount} 积分`
            : `已撤回《${item.songName}》`,
        )
        await options.onActiveUpdated?.()
        await refreshUserPoints()
      } else {
        message.error(`撤回失败: ${data.message}`)
      }
    } catch (err) {
      message.error(`撤回失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      cancellingId.value = null
    }
  }

  function cancelPending() {
    pendingSong.value = null
  }

  return {
    biliAuth,
    isLoggedIn,
    userPoints,
    pendingSong,
    usePriorityOnRequest,
    isSubmittingRequest,
    prioritizingId,
    cancellingId,
    hasPointFeatures,
    basePointCost,
    priorityPointCost,
    totalPendingPointCost,
    myWaitingSongs,
    getDanmakuCommand,
    checkSongRequestable,
    refreshUserPoints,
    requestSong,
    submitWebSongRequest,
    priorityExistingSong,
    cancelExistingSong,
    cancelPending,
  }
}
