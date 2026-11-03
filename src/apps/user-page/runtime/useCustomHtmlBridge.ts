import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import { postApiLiveRequestAddFromWeb } from '@/api/generated/live-request/live-request'
import type { ResponseSongModel, ResponseUserInfo } from '@/api/generated/model'
import { unwrapOk } from '@/api/query'
import { fetchPublicSongRequestState } from '@/apps/user-page/api'
import type { CustomHtmlAsset } from '@/apps/user-page/block/customHtmlContract'
import { getEnabledUserFunctions, USER_FEATURE_DEFINITIONS } from '@/apps/user-page/featureNavigation'
import type { BiliProfile } from '@/apps/user-page/types'
import { canRequestSong } from '@/apps/user/pages/songListTemplate/utils/songRequestUtils'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useMessage } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import type { CustomHtmlBridgeHandlers, VtsuruSandboxSdkTheme } from './customHtmlBridge'
import { createCustomHtmlDataHandlers } from './customHtmlData'

export interface CustomHtmlHostDialogState {
  song: Ref<ResponseSongModel | null>
  questionOpen: Ref<boolean>
  questionTag: Ref<string>
  questionTags: Ref<string[]>
  confirmSong: (confirmed: boolean) => void
}

function createSongConfirmation() {
  const song = ref<ResponseSongModel | null>(null)
  let resolveConfirmation: ((confirmed: boolean) => void) | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  function confirmSong(confirmed: boolean) {
    clearTimeout(timer)
    resolveConfirmation?.(confirmed)
    resolveConfirmation = null
    song.value = null
  }
  function wait(selected: ResponseSongModel) {
    song.value = selected
    return new Promise<boolean>((resolve) => {
      resolveConfirmation = resolve
      timer = setTimeout(() => confirmSong(false), 14_000)
    })
  }
  return { song, confirmSong, wait }
}

function createSongRequestAction(user: () => ResponseUserInfo, data: ReturnType<typeof createCustomHtmlDataHandlers>) {
  const account = useAccount(),
    auth = useBiliAuth(),
    message = useMessage()
  const nextRequestTime = usePersistedStorage('SongList.NextRequestTime', new Date())
  const confirmation = createSongConfirmation()
  let activeRequest: ReturnType<typeof runRequest> | null = null
  let generation = 0
  function cancel() {
    generation += 1
    activeRequest = null
    confirmation.confirmSong(false)
  }
  function assertSession(ownerId: number, started: number) {
    if (generation !== started || user().id !== ownerId) throw new Error('页面已切换，操作已取消')
  }
  async function requestSong(params: unknown) {
    if (activeRequest) throw new Error('已有待确认或正在提交的点歌')
    const request = runRequest(params)
    activeRequest = request
    try {
      return await request
    } finally {
      if (activeRequest === request) activeRequest = null
    }
  }
  async function runRequest(params: unknown) {
    if (typeof params !== 'string' || !params.trim() || params.length > 200) throw new TypeError('Invalid song')
    const ownerId = user().id,
      started = generation
    const [selected, state] = await Promise.all([data.findSong(params), fetchPublicSongRequestState(ownerId)])
    assertSession(ownerId, started)
    if (!selected) throw new Error('歌曲不存在')
    const check = canRequestSong(
      selected,
      user(),
      state.setting,
      Boolean(account.value.id),
      auth.isAuthed,
      nextRequestTime.value,
    )
    if (check.shouldCopyOnly) {
      await navigator.clipboard.writeText(`${state.setting?.orderPrefix ?? ''} ${selected.name}`.trim())
      assertSession(ownerId, started)
      message.info(check.reason)
      return { action: 'copied', message: check.reason }
    }
    if (!check.canRequest) throw new Error(check.reason)
    if (Date.now() < nextRequestTime.value.getTime()) throw new Error('点歌冷却中')
    const approved = await confirmation.wait(selected)
    if (!approved) return { action: 'cancelled', message: '已取消点歌' }
    assertSession(ownerId, started)
    const requestOptions = auth.isAuthed ? { headers: Object.fromEntries(await auth.getBiliAuthHeaders()) } : undefined
    assertSession(ownerId, started)
    unwrapOk(await postApiLiveRequestAddFromWeb({ target: ownerId, song: selected.key }, requestOptions), '点歌失败')
    nextRequestTime.value = new Date(Date.now() + 30_000)
    assertSession(ownerId, started)
    message.success('点歌成功')
    return { action: 'requested', message: '点歌成功' }
  }
  return {
    song: confirmation.song,
    confirmSong: confirmation.confirmSong,
    cancel,
    requestSong,
    sessionVersion: () => generation,
  }
}

function contextFor(
  info: ResponseUserInfo,
  bili: BiliProfile | undefined,
  options: Parameters<typeof useCustomHtmlBridge>[0],
) {
  return {
    streamer: {
      id: info.id,
      name: info.name,
      biliId: info.biliId ?? 0,
      roomId: info.streamerInfo.roomId,
      faceUrl: info.faceUrl ?? '',
      title: info.streamerInfo.title,
      bio: info.indexNotification ?? '',
      isStreaming: Boolean(info.streamerInfo.isStreaming),
      enabledFeatures: USER_FEATURE_DEFINITIONS.filter((feature) =>
        getEnabledUserFunctions(info).has(feature.functionType!),
      ).map((feature) => feature.key),
    },
    bili: bili ? { ...bili } : null,
    theme: toValue(options.theme) ?? {
      isDark: false,
      primaryColor: '#18a058',
      accentColor: '#18a058',
      bgColor: '#fff',
      fgColor: '#18181b',
      cardBg: '#fff',
      borderColor: '#e4e4e7',
      mutedColor: '#71717a',
    },
    page: {
      slug: toValue(options.pageSlug) ?? null,
      mode: toValue(options.pageMode) ?? 'block',
      immersive: toValue(options.immersive) ?? false,
    },
  }
}

async function navigateTo(params: unknown, id: number, router: ReturnType<typeof useRouter>) {
  if (typeof params !== 'string') throw new TypeError('Invalid navigation target')
  const owner = String(id)
  if (params === 'home') {
    await router.push({ name: 'user-index', params: { id: owner } })
    return
  }
  if (params.startsWith('page:')) {
    const slug = params.slice(5)
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw new Error('Invalid page slug')
    await router.push({ name: 'user-page', params: { id: owner, pageSlug: slug } })
    return
  }
  const routes: Record<string, string> = {
    songlist: 'user-songList',
    schedule: 'user-schedule',
    'question-box': 'user-questionBox',
    'check-in-ranking': 'user-checkin',
    forum: 'user-forum',
    'video-collect': 'user-video-collect',
    'point-goods': 'user-goods',
  }
  const routeName = routes[params]
  if (!routeName) throw new Error('Unsupported navigation target')
  await router.push({ name: routeName, params: { id: owner } })
}

function createToastHandler(message: ReturnType<typeof useMessage>) {
  let lastToastAt = 0
  return (params: unknown) => {
    const value = params as { message?: unknown; type?: unknown }
    if (
      !value ||
      typeof value.message !== 'string' ||
      value.message.length > 200 ||
      !['info', 'success', 'warning', 'error'].includes(String(value.type))
    )
      throw new TypeError('Invalid toast')
    if (Date.now() - lastToastAt < 1500) return
    lastToastAt = Date.now()
    message[value.type as 'info'](value.message)
  }
}

export function useCustomHtmlBridge(options: {
  userInfo: MaybeRefOrGetter<ResponseUserInfo | undefined>
  biliInfo?: MaybeRefOrGetter<BiliProfile | undefined>
  pageSlug?: MaybeRefOrGetter<string | null | undefined>
  pageMode?: MaybeRefOrGetter<'block' | 'custom'>
  immersive?: MaybeRefOrGetter<boolean>
  assets?: MaybeRefOrGetter<CustomHtmlAsset[]>
  theme?: MaybeRefOrGetter<VtsuruSandboxSdkTheme>
}) {
  const router = useRouter(),
    message = useMessage()
  const questionOpen = ref(false),
    questionTag = ref(''),
    questionTags = ref<string[]>([])
  const user = () => {
    const info = toValue(options.userInfo)
    if (!info?.id) throw new Error('主播信息尚未加载')
    return info
  }
  const data = createCustomHtmlDataHandlers(() => user().id)
  const songRequest = createSongRequestAction(user, data)
  const dialog: CustomHtmlHostDialogState = {
    song: songRequest.song,
    questionOpen,
    questionTag,
    questionTags,
    confirmSong: songRequest.confirmSong,
  }
  function cancelPending() {
    songRequest.cancel()
    questionOpen.value = false
  }
  watch(() => userSafeId(), cancelPending)
  onScopeDispose(cancelPending)
  function userSafeId() {
    return toValue(options.userInfo)?.id
  }

  const handlers = computed<CustomHtmlBridgeHandlers>(() => ({
    getContext: () => contextFor(user(), toValue(options.biliInfo), options),
    getSongs: data.getSongs,
    getSongRequestState: data.getSongRequestState,
    getSchedule: async (params) => ({
      ...(await data.getSchedule(params)),
      liveRoomUrl: user().biliRoomId ? `https://live.bilibili.com/${user().biliRoomId}` : '',
    }),
    getCheckInRanking: data.getCheckInRanking,
    getQuestions: (params) => data.getQuestions(params, user().extra?.showQuestionBoxPublicReplies !== false),
    getPointGoods: data.getPointGoods,
    getVideoCollects: data.getVideoCollects,
    requestSong: songRequest.requestSong,
    async openQuestionBox(params) {
      if (params != null && (typeof params !== 'string' || params.length > 100))
        throw new TypeError('Invalid question tag')
      const ownerId = user().id,
        started = songRequest.sessionVersion()
      questionTag.value = typeof params === 'string' ? params : ''
      questionTags.value = (await data.getQuestions(undefined, false)).tags
      if (user().id !== ownerId || songRequest.sessionVersion() !== started) throw new Error('页面已切换，操作已取消')
      questionOpen.value = true
    },
    navigate: (params) => navigateTo(params, user().id, router),
    async copyText(params) {
      if (typeof params !== 'string' || !params.length || params.length > 500)
        throw new TypeError('Text length must be 1 to 500')
      await navigator.clipboard.writeText(params)
      message.success('已复制')
      return true
    },
    toast: createToastHandler(message),
  }))

  return { handlers, dialog, cancelPending }
}
