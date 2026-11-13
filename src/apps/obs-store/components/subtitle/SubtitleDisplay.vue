<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'

import { DEFAULT_SUBTITLE_STATE } from './types'
import type { SubtitleAction, SubtitleState } from './types'

const props = defineProps<{
  channelId?: string
  inlineMode?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state } = useObsBridge<SubtitleState, SubtitleAction>({
  componentId: 'subtitle',
  channelId: targetChannel,
  defaultState: DEFAULT_SUBTITLE_STATE,
  role: 'viewer',
})

const nowMs = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = Date.now()
  }, 500)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const isExpired = computed(() => {
  const fadeMs = (state.value.fadeSeconds ?? 8) * 1000
  if (fadeMs <= 0) return false
  if (!state.value.updatedAt) return false
  return nowMs.value - state.value.updatedAt > fadeMs
})

const visibleLines = computed(() => {
  if (isExpired.value) return []
  const max = Math.max(1, Math.min(5, state.value.maxLines || 2))
  const list = state.value.lines.map((item) => item.text).filter(Boolean)
  const partial = state.value.showPartial ? state.value.partialText.trim() : ''
  const combined = partial ? [...list, partial] : list
  return combined.slice(-max)
})

const alignClass = computed(() => {
  switch (state.value.align) {
    case 'left':
      return 'items-start text-left'
    case 'right':
      return 'items-end text-right'
    default:
      return 'items-center text-center'
  }
})
</script>

<template>
  <div
    class="w-full h-full flex flex-col justify-end p-4 select-none overflow-hidden"
    :class="[alignClass, inlineMode ? 'min-h-[140px]' : 'min-h-screen']"
  >
    <TransitionGroup
      name="subtitle-line"
      tag="div"
      class="flex flex-col gap-1.5 max-w-full"
      :class="alignClass"
    >
      <div
        v-for="(line, idx) in visibleLines"
        :key="`${idx}-${line}`"
        class="px-3.5 py-1.5 rounded-lg leading-snug break-words transition-all duration-200 max-w-full"
        :style="{
          fontSize: `${state.fontSize || 32}px`,
          fontWeight: state.fontWeight || 700,
          color: state.textColor || '#ffffff',
          backgroundColor: state.bgColor || 'rgba(15, 23, 42, 0.55)',
          textShadow: `0 2px 6px ${state.strokeColor || '#000000'}, 0 0 2px ${state.strokeColor || '#000000'}`,
        }"
      >
        {{ line }}
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.subtitle-line-enter-active,
.subtitle-line-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.subtitle-line-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.subtitle-line-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
