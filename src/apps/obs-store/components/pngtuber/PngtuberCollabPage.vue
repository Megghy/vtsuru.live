<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { normalizePngtuberState } from '@/shared/pngtuber/normalize'
import type { PngtuberState } from '@/shared/pngtuber/types'
import { useRealtimeTopic } from '@/shared/realtime'

import PngtuberDisplay from './PngtuberDisplay.vue'

interface MemberState {
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

const route = useRoute()
const roomCode = computed(() => {
  const r = route.query.room
  return (Array.isArray(r) ? r[0] : r || '').toString().trim().toUpperCase()
})
const spotlight = computed(() => route.query.spotlight !== '0')
const layout = computed(() => (route.query.layout === 'grid' ? 'grid' : 'row'))

const members = ref<MemberState[]>([])

function parseConfig(raw: unknown): PngtuberState {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
    return normalizePngtuberState(obj || {})
  } catch {
    return normalizePngtuberState({})
  }
}

if (roomCode.value) {
  const topic = useRealtimeTopic(`pngtuber:room:${roomCode.value}`)

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
      config: parseConfig(m.config),
    }))
  })

  topic.on('member_joined', (payload: any) => {
    if (!payload || !payload.userId) return
    const idx = members.value.findIndex((m) => m.userId === payload.userId)
    const item: MemberState = {
      userId: payload.userId,
      name: payload.name || `用户 ${payload.userId}`,
      avatar: payload.avatar || '',
      isSpeaking: Boolean(payload.isSpeaking),
      volume: Number(payload.volume) || 0,
      expressionId: payload.expressionId || '',
      muted: Boolean(payload.muted),
      away: Boolean(payload.away),
      config: parseConfig(payload.config),
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
}

const hasActiveSpeaker = computed(() => {
  return spotlight.value && members.value.some((m) => m.isSpeaking)
})
</script>

<template>
  <div
    class="pngtuber-collab-viewport fixed inset-0 overflow-hidden select-none pointer-events-none"
    :class="[
      layout === 'grid'
        ? 'grid grid-cols-2 place-items-center gap-6 p-4'
        : 'flex items-end justify-center gap-8 pb-4 px-4',
    ]"
  >
    <div
      v-if="!roomCode"
      class="text-xs text-muted-foreground/60 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded"
    >
      OBS 联动源已加载 · 请在 URL 中附加 ?room=房间码
    </div>

    <div
      v-else-if="members.length === 0"
      class="text-xs text-muted-foreground/60 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded"
    >
      联动房间 [{{ roomCode }}] 就绪 · 等待成员加入...
    </div>

    <div
      v-for="member in members"
      :key="member.userId"
      class="collab-slot transition-all duration-200 ease-out flex flex-col items-center justify-end"
      :class="{
        'scale-[1.03] z-10': spotlight && member.isSpeaking,
        'opacity-75 scale-[0.98]': hasActiveSpeaker && !member.isSpeaking,
      }"
    >
      <PngtuberDisplay
        :state="member.config"
        :is-speaking="member.isSpeaking"
        :volume="member.volume"
        :expression-id="member.expressionId"
        :muted="member.muted"
        :away="member.away"
      />
    </div>
  </div>
</template>

<style scoped>
.collab-slot {
  transform-origin: bottom center;
}
</style>
