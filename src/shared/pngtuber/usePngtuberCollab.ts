import { computed, effectScope, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import { QueryPostAPI } from '@/api/query'
import { OBS_STORE_API_URL } from '@/shared/config/endpoints'
import { useRealtimeTopic } from '@/shared/realtime'

import { normalizePngtuberState } from './normalize'
import type { PngtuberState } from './types'

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

const currentRoomCode = ref('')
const isHost = ref(false)
const members = ref<CollabMemberItem[]>([])
const collabError = ref('')
let activeScope: ReturnType<typeof effectScope> | null = null

export function usePngtuberCollab() {
  const account = useAccount()
  const inRoom = computed(() => Boolean(currentRoomCode.value))

  async function createRoom(preferredCode?: string): Promise<string> {
    try {
      collabError.value = ''
      const url = new URL(`${OBS_STORE_API_URL}pngtuber/collab/create-room`)
      if (preferredCode) url.searchParams.set('code', preferredCode)
      const res = await QueryPostAPI<{ roomCode: string; hostUserId: number }>(url.toString(), {})
      const code = res.data.roomCode
      await joinRoom(code, true)
      return code
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause)
      collabError.value = msg
      throw cause
    }
  }

  async function joinRoom(code: string, asHost = false, currentConfig?: PngtuberState): Promise<void> {
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) throw new Error('请输入有效的房间码')

    leaveRoom()

    currentRoomCode.value = cleanCode
    isHost.value = asHost
    members.value = []

    const scope = effectScope()
    activeScope = scope

    scope.run(() => {
      const topic = useRealtimeTopic(`pngtuber:room:${cleanCode}`)

      topic.on('room_snapshot', (payload: any) => {
        if (!payload || !Array.isArray(payload.members)) return
        members.value = payload.members.map((m: any) => ({
          userId: m.userId,
          name: m.name || `用户 ${m.userId}`,
          avatar: m.avatar || '',
          isSpeaking: Boolean(m.isSpeaking),
          volume: Number(m.volume) || 0,
          expressionId: m.expressionId || '',
          muted: Boolean(m.muted),
          away: Boolean(m.away),
          config: parseMemberConfig(m.config),
        }))
      })

      topic.on('member_joined', (payload: any) => {
        if (!payload || !payload.userId) return
        const idx = members.value.findIndex((m) => m.userId === payload.userId)
        const item: CollabMemberItem = {
          userId: payload.userId,
          name: payload.name || `用户 ${payload.userId}`,
          avatar: payload.avatar || '',
          isSpeaking: Boolean(payload.isSpeaking),
          volume: Number(payload.volume) || 0,
          expressionId: payload.expressionId || '',
          muted: Boolean(payload.muted),
          away: Boolean(payload.away),
          config: parseMemberConfig(payload.config),
        }
        if (idx >= 0) {
          members.value[idx] = item
        } else {
          members.value.push(item)
        }
      })

      topic.on('member_audio', (payload: any) => {
        if (!payload || !payload.userId) return
        const m = members.value.find((item) => item.userId === payload.userId)
        if (m) {
          m.volume = Number(payload.volume) || 0
          m.isSpeaking = Boolean(payload.isSpeaking)
        }
      })

      topic.on('member_control', (payload: any) => {
        if (!payload || !payload.userId) return
        const m = members.value.find((item) => item.userId === payload.userId)
        if (m) {
          if (payload.expressionId !== undefined) m.expressionId = payload.expressionId
          if (payload.muted !== undefined) m.muted = Boolean(payload.muted)
          if (payload.away !== undefined) m.away = Boolean(payload.away)
          if (m.muted || m.away) {
            m.volume = 0
            m.isSpeaking = false
          }
        }
      })

      topic.on('member_left', (payload: any) => {
        if (!payload || !payload.userId) return
        members.value = members.value.filter((item) => item.userId !== payload.userId)
      })

      // 加入时上报本人的基础信息与当前立绘配置
      if (account.value.id) {
        void topic.publish('join', {
          userId: account.value.id,
          name: account.value.name,
          avatar: '',
          config: currentConfig || {},
        })
      }
    })
  }

  function parseMemberConfig(raw: any): PngtuberState {
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
      return normalizePngtuberState(obj || {})
    } catch {
      return normalizePngtuberState({})
    }
  }

  function leaveRoom() {
    if (activeScope) {
      activeScope.stop()
      activeScope = null
    }
    currentRoomCode.value = ''
    isHost.value = false
    members.value = []
  }

  return {
    currentRoomCode,
    isHost,
    inRoom,
    members,
    collabError,
    createRoom,
    joinRoom,
    leaveRoom,
  }
}
