<script setup lang="ts">
import Wrench24Regular from '@vicons/fluent/es/Wrench24Regular'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { firstQueryValue } from '@/shared/obs/obsUrl'
import { normalizeCollabSettings, type PngtuberCollabSettings } from '@/shared/pngtuber/collabSettings'
import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'
import type { PngtuberState } from '@/shared/pngtuber/types'
import { watchCollabRoom, type CollabMemberItem } from '@/shared/pngtuber/usePngtuberCollab'
import { usePngtuberDebugger } from '@/shared/pngtuber/usePngtuberDebugger'
import { Button } from '@/shared/ui/button'
import { Progress } from '@/shared/ui/progress'
import { Slider } from '@/shared/ui/slider'

import PngtuberDisplay from './PngtuberDisplay.vue'

const route = useRoute()
const channel = computed(() => resolveObsSyncChannel(route.query.channel))

const bridge = useObsBridge<PngtuberState>({
  componentId: 'pngtuber',
  channelId: channel,
  defaultState: structuredClone(DEFAULT_PNGTUBER_STATE),
  role: 'viewer',
})

const { isMockCollab, mockMembers, startMockCollab, toggleMockCollab, cycleCollabSpeaker, addMockMember } =
  usePngtuberDebugger()

function queryFlag(key: string) {
  const v = firstQueryValue(route.query[key]).toLowerCase()
  return v === '1' || v === 'true'
}

const roomCode = computed(() => firstQueryValue(route.query.room).trim().toUpperCase())
const realMembers = ref<CollabMemberItem[]>([])
const showDebugPanel = ref(queryFlag('debug') || queryFlag('mock'))
const debugOverride = ref<Partial<PngtuberCollabSettings>>({})

const effectiveSettings = computed(() =>
  normalizeCollabSettings({ ...bridge.state.value.collab, ...debugOverride.value }),
)

function patchDebugSetting(patch: Partial<PngtuberCollabSettings>) {
  debugOverride.value = { ...debugOverride.value, ...patch }
}

if (roomCode.value) {
  watchCollabRoom(roomCode.value, realMembers)
}

if (queryFlag('mock')) {
  startMockCollab()
}

const members = computed(() => (isMockCollab.value ? mockMembers.value : realMembers.value))

const hasActiveSpeaker = computed(() => {
  return effectiveSettings.value.spotlight && members.value.some((m) => m.isSpeaking)
})

const containerLayoutClasses = computed(() => {
  const s = effectiveSettings.value
  if (s.layout === 'grid') return 'grid grid-cols-2 place-items-center'
  if (s.layout === 'column') {
    const alignClass =
      s.alignment === 'top' ? 'justify-start' : s.alignment === 'center' ? 'justify-center' : 'justify-end'
    return `flex flex-col items-center ${alignClass}`
  }
  const alignClass = s.alignment === 'top' ? 'items-start' : s.alignment === 'center' ? 'items-center' : 'items-end'
  return `flex flex-row justify-center ${alignClass}`
})

const transformOriginClass = computed(() => {
  const s = effectiveSettings.value
  if (s.alignment === 'top') return 'origin-top'
  if (s.alignment === 'center') return 'origin-center'
  return 'origin-bottom'
})

function getMemberTransform(m: CollabMemberItem) {
  const s = effectiveSettings.value
  if (s.spotlight && m.isSpeaking) {
    return `scale(${Number((s.scale * s.activeScale).toFixed(3))})`
  }
  return `scale(${s.scale})`
}

function getMemberOpacity(m: CollabMemberItem) {
  if (hasActiveSpeaker.value && !m.isSpeaking) return effectiveSettings.value.inactiveOpacity
  return 1
}
</script>

<template>
  <div
    class="pngtuber-collab-viewport fixed inset-0 overflow-hidden select-none pointer-events-none"
    :class="containerLayoutClasses"
    :style="{
      gap: `${effectiveSettings.gap}px`,
      padding: `${effectiveSettings.padding}px`,
    }"
  >
    <div
      v-if="!roomCode && !isMockCollab"
      class="text-xs text-muted-foreground/80 bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-lg border border-white/10 pointer-events-auto"
    >
      OBS 组队画面已就绪 · 请附加 ?room=房间码
      <Button
        variant="link"
        class="ml-1 h-auto px-1 text-xs"
        @click="startMockCollab()"
      >
        开启前端模拟测试
      </Button>
    </div>

    <div
      v-else-if="members.length === 0"
      class="text-xs text-muted-foreground/80 bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-lg border border-white/10 pointer-events-auto"
    >
      联动房间 [{{ roomCode }}] 就绪 · 等待成员加入...
      <Button
        variant="link"
        class="ml-1 h-auto px-1 text-xs"
        @click="startMockCollab()"
      >
        模拟多人入房
      </Button>
    </div>

    <div
      v-for="member in members"
      :key="member.userId"
      class="collab-slot transition-all duration-200 ease-out flex flex-col items-center"
      :class="[transformOriginClass, { 'z-10': member.isSpeaking }]"
      :style="{
        transform: getMemberTransform(member),
        opacity: getMemberOpacity(member),
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

      <div
        v-if="effectiveSettings.showNames"
        class="member-nametag mt-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex flex-col items-center gap-1 shadow-lg transition-all"
        :class="{
          'border-primary/80 ring-1 ring-primary/50 scale-105': member.isSpeaking,
        }"
      >
        <div class="flex items-center gap-1.5 text-[11px] text-white/90 font-medium">
          <span
            class="size-2 rounded-full shrink-0 transition-colors"
            :class="member.isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'"
          />
          <span class="truncate max-w-[120px]">{{ member.name }}</span>
        </div>

        <Progress
          v-if="effectiveSettings.showVolumeBar && member.isSpeaking"
          :model-value="Math.min(100, Math.max(0, Math.round(member.volume)))"
          class="h-1 w-16 bg-white/20"
        />
      </div>
    </div>

    <div
      v-if="showDebugPanel"
      class="fixed bottom-3 right-3 z-50 pointer-events-auto bg-black/80 backdrop-blur-lg border border-white/20 rounded-xl p-3 shadow-2xl text-white text-xs max-w-xs space-y-2.5"
    >
      <div class="flex-between border-b border-white/10 pb-1.5">
        <span class="font-semibold flex items-center gap-1 text-amber-400">
          <Wrench24Regular class="size-3.5" />
          组队画面调试控制器
        </span>
        <Button
          variant="ghost"
          size="xs"
          class="p-0 text-white/60 hover:text-white"
          @click="showDebugPanel = false"
        >
          关闭
        </Button>
      </div>

      <div class="flex items-center gap-1.5 flex-wrap">
        <Button
          variant="outline"
          size="xs"
          class="bg-white/10 text-white border-white/20 hover:bg-white/20"
          @click="toggleMockCollab()"
        >
          {{ isMockCollab ? '退出模拟' : '开启 3 人模拟' }}
        </Button>
        <Button
          v-if="isMockCollab"
          variant="outline"
          size="xs"
          class="bg-white/10 text-white border-white/20 hover:bg-white/20"
          @click="cycleCollabSpeaker()"
        >
          轮流发言
        </Button>
        <Button
          v-if="isMockCollab"
          variant="outline"
          size="xs"
          class="bg-white/10 text-white border-white/20 hover:bg-white/20"
          @click="addMockMember()"
        >
          + 队友
        </Button>
      </div>

      <div class="space-y-1.5 pt-1 border-t border-white/10">
        <div class="flex justify-between items-center text-[11px] text-white/80">
          <span>间距 (Gap)</span>
          <span class="font-mono text-amber-300">{{ effectiveSettings.gap }}px</span>
        </div>
        <Slider
          :min="0"
          :max="160"
          :step="4"
          :model-value="[effectiveSettings.gap]"
          @update:model-value="patchDebugSetting({ gap: $event?.[0] })"
        />
      </div>

      <div class="space-y-1.5">
        <div class="flex justify-between items-center text-[11px] text-white/80">
          <span>大小 (Scale)</span>
          <span class="font-mono text-amber-300">{{ Math.round(effectiveSettings.scale * 100) }}%</span>
        </div>
        <Slider
          :min="0.5"
          :max="1.6"
          :step="0.05"
          :model-value="[effectiveSettings.scale]"
          @update:model-value="patchDebugSetting({ scale: $event?.[0] })"
        />
      </div>
    </div>
  </div>
</template>
