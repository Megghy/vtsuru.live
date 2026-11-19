import { computed, effectScope, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

import { useAccount } from '@/api/account'
import { QueryPostAPI } from '@/api/query'
import { OBS_STORE_API_URL } from '@/shared/config/endpoints'
import { getRealtimeBus, useRealtimeTopic } from '@/shared/realtime'

import { normalizePngtuberState } from './normalize'
import type { PngtuberRuntime, PngtuberState } from './types'

export interface CollabMemberItem {
  userId: number
  name: string
  avatar: string
  isSpeaking: boolean
  volume: number
  expressionId: string
  muted: boolean
  away: boolean
  config: PngtuberState
}

export interface CollabRoomMeta {
  hostUserId: number
  isLocked: boolean
  hasPasscode: boolean
}

const currentRoomCode = ref('')
const hostUserId = ref(0)
const isLocked = ref(false)
const hasPasscode = ref(false)
const members = ref<CollabMemberItem[]>([])
const collabError = ref('')
let activeScope: ReturnType<typeof effectScope> | null = null
let activeTopicPublish: ((eventName: string, payload?: unknown) => Promise<void>) | null = null

export function parseMemberConfig(raw: unknown): PngtuberState {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    return normalizePngtuberState(obj || {})
  } catch {
    return normalizePngtuberState({})
  }
}

interface RawMemberPayload {
  userId?: number
  name?: string
  avatar?: string
  isSpeaking?: boolean
  volume?: number
  expressionId?: string
  muted?: boolean
  away?: boolean
  config?: unknown
}

function mapMember(payload: RawMemberPayload): CollabMemberItem {
  const uid = Number(payload.userId) || 0
  return {
    userId: uid,
    name: payload.name || `用户 ${uid}`,
    avatar: payload.avatar || '',
    isSpeaking: Boolean(payload.isSpeaking),
    volume: Number(payload.volume) || 0,
    expressionId: payload.expressionId || '',
    muted: Boolean(payload.muted),
    away: Boolean(payload.away),
    config: parseMemberConfig(payload.config),
  }
}

export function watchCollabRoom(
  code: MaybeRefOrGetter<string>,
  list: Ref<CollabMemberItem[]>,
  options?: {
    onMeta?: (meta: CollabRoomMeta) => void
    onClosed?: (reason: string) => void
    onKicked?: (userId: number) => void
  },
) {
  const topicName = computed(() => {
    const clean = toValue(code).trim().toUpperCase()
    return clean ? `pngtuber:room:${clean}` : ''
  })
  const topic = useRealtimeTopic(topicName)

  watch(topicName, () => {
    list.value = []
  })

  topic.on<{
    hostUserId?: number
    isLocked?: boolean
    hasPasscode?: boolean
    members?: RawMemberPayload[]
  }>('room_snapshot', (payload) => {
    if (!payload) return
    options?.onMeta?.({
      hostUserId: Number(payload.hostUserId) || 0,
      isLocked: Boolean(payload.isLocked),
      hasPasscode: Boolean(payload.hasPasscode),
    })
    if (Array.isArray(payload.members)) {
      list.value = payload.members.map(mapMember)
    }
  })

  topic.on<{ hostUserId?: number; isLocked?: boolean; hasPasscode?: boolean }>('room_meta', (payload) => {
    if (!payload) return
    options?.onMeta?.({
      hostUserId: Number(payload.hostUserId) || 0,
      isLocked: Boolean(payload.isLocked),
      hasPasscode: Boolean(payload.hasPasscode),
    })
  })

  topic.on<{ reason?: string }>('room_closed', (payload) => {
    list.value = []
    options?.onClosed?.(payload?.reason || '房间不存在或已解散')
  })

  topic.on<RawMemberPayload>('member_joined', (payload) => {
    if (!payload?.userId) return
    const item = mapMember(payload)
    const idx = list.value.findIndex((m) => m.userId === payload.userId)
    if (idx >= 0) list.value[idx] = item
    else list.value.push(item)
  })

  topic.on<{ userId?: number; config?: unknown }>('member_config', (payload) => {
    if (!payload?.userId) return
    const m = list.value.find((item) => item.userId === payload.userId)
    if (m) m.config = parseMemberConfig(payload.config)
  })

  topic.on<{ userId?: number; volume?: number; isSpeaking?: boolean }>('member_audio', (payload) => {
    if (!payload?.userId) return
    const m = list.value.find((item) => item.userId === payload.userId)
    if (m) {
      m.volume = Number(payload.volume) || 0
      m.isSpeaking = Boolean(payload.isSpeaking)
    }
  })

  topic.on<{
    userId?: number
    expressionId?: string
    muted?: boolean
    away?: boolean
    volume?: number
    isSpeaking?: boolean
  }>('member_control', (payload) => {
    if (!payload?.userId) return
    const m = list.value.find((item) => item.userId === payload.userId)
    if (m) {
      if (payload.expressionId !== undefined) m.expressionId = payload.expressionId
      if (payload.muted !== undefined) m.muted = Boolean(payload.muted)
      if (payload.away !== undefined) m.away = Boolean(payload.away)
      if (payload.volume !== undefined) m.volume = Number(payload.volume) || 0
      if (payload.isSpeaking !== undefined) m.isSpeaking = Boolean(payload.isSpeaking)
      if (m.muted || m.away) {
        m.volume = 0
        m.isSpeaking = false
      }
    }
  })

  topic.on<{ userId?: number; kicked?: boolean }>('member_left', (payload) => {
    if (!payload?.userId) return
    list.value = list.value.filter((item) => item.userId !== payload.userId)
    if (payload.kicked) options?.onKicked?.(payload.userId)
  })

  return topic
}

export function usePngtuberCollab() {
  const account = useAccount()
  const inRoom = computed(() => Boolean(currentRoomCode.value))
  const isHost = computed(() => Boolean(inRoom.value && account.value.id && hostUserId.value === account.value.id))

  async function createRoom(currentConfig?: PngtuberState, passcode?: string): Promise<string> {
    try {
      collabError.value = ''
      const url = new URL(`${OBS_STORE_API_URL}pngtuber/collab/create-room`)
      if (passcode?.trim()) url.searchParams.set('passcode', passcode.trim())
      const res = await QueryPostAPI<{
        roomCode: string
        hostUserId: number
        isLocked?: boolean
        hasPasscode?: boolean
      }>(url.toString(), {})
      if ((res.code !== undefined && res.code !== 200) || !res.data?.roomCode) {
        throw new Error(res.message || '创建组队房间失败')
      }
      const code = res.data.roomCode
      await joinRoom(code, true, currentConfig, passcode)
      return code
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause)
      collabError.value = msg
      throw cause
    }
  }

  async function joinRoom(
    code: string,
    asHost = false,
    currentConfig?: PngtuberState,
    passcode?: string,
  ): Promise<void> {
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) throw new Error('请输入有效的房间码')
    if (!account.value.id) throw new Error('请先登录后加入组队房间')

    leaveRoom()
    collabError.value = ''
    currentRoomCode.value = cleanCode
    hostUserId.value = asHost ? account.value.id : 0
    isLocked.value = false
    hasPasscode.value = Boolean(passcode?.trim())
    members.value = []

    const scope = effectScope()
    activeScope = scope

    let publishFn: ((eventName: string, payload?: unknown) => Promise<void>) | null = null
    scope.run(() => {
      const topic = watchCollabRoom(cleanCode, members, {
        onMeta(meta) {
          hostUserId.value = meta.hostUserId
          isLocked.value = meta.isLocked
          hasPasscode.value = meta.hasPasscode
        },
        onClosed(reason) {
          collabError.value = reason
          leaveRoom()
        },
        onKicked(uid) {
          if (uid === account.value.id) {
            collabError.value = '你已被房主移出房间'
            leaveRoom()
          }
        },
      })
      publishFn = topic.publish
      activeTopicPublish = topic.publish
    })

    try {
      await publishFn?.('join', {
        userId: account.value.id,
        name: account.value.name,
        avatar: '',
        passcode: passcode?.trim() || '',
        config: currentConfig || {},
      })
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause)
      leaveRoom()
      collabError.value = msg
      throw cause
    }
  }

  function leaveRoom() {
    const code = currentRoomCode.value
    const publish = activeTopicPublish
    activeTopicPublish = null
    if (code && publish) {
      void publish('leave', { userId: account.value.id }).catch(() => {})
    }
    if (activeScope) {
      activeScope.stop()
      activeScope = null
    }
    currentRoomCode.value = ''
    hostUserId.value = 0
    isLocked.value = false
    hasPasscode.value = false
    members.value = []
  }

  function broadcastAudio(volume: number, isSpeaking: boolean) {
    if (!currentRoomCode.value || !account.value.id) return
    void getRealtimeBus()
      .publish(`pngtuber:room:${currentRoomCode.value}`, 'audio', {
        userId: account.value.id,
        volume,
        isSpeaking,
      })
      .catch(() => {})
  }

  function broadcastControl(patch: Partial<Pick<PngtuberRuntime, 'expressionId' | 'muted' | 'away'>>, durationMs = 0) {
    if (!currentRoomCode.value || !account.value.id) return
    void getRealtimeBus()
      .publish(`pngtuber:room:${currentRoomCode.value}`, 'control', {
        userId: account.value.id,
        ...patch,
        durationMs,
      })
      .catch(() => {})
  }

  function broadcastConfig(config: PngtuberState) {
    if (!currentRoomCode.value || !account.value.id) return
    void getRealtimeBus()
      .publish(`pngtuber:room:${currentRoomCode.value}`, 'update_config', { config })
      .catch(() => {})
  }

  async function kickMember(targetUserId: number) {
    if (!currentRoomCode.value || !isHost.value) throw new Error('仅房主可以移出成员')
    await getRealtimeBus().publish(`pngtuber:room:${currentRoomCode.value}`, 'kick', { targetUserId })
  }

  async function setRoomLocked(locked: boolean) {
    if (!currentRoomCode.value || !isHost.value) throw new Error('仅房主可以修改房间锁定状态')
    await getRealtimeBus().publish(`pngtuber:room:${currentRoomCode.value}`, 'lock', { locked })
  }

  return {
    currentRoomCode,
    hostUserId,
    isHost,
    isLocked,
    hasPasscode,
    inRoom,
    members,
    collabError,
    createRoom,
    joinRoom,
    leaveRoom,
    broadcastAudio,
    broadcastControl,
    broadcastConfig,
    kickMember,
    setRoomLocked,
  }
}
