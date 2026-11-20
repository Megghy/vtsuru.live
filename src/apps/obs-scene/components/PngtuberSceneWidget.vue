<script setup lang="ts">
import { computed } from 'vue'

import PngtuberDisplay from '@/apps/obs-store/components/pngtuber/PngtuberDisplay.vue'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { normalizePngtuberState } from '@/shared/pngtuber/normalize'
import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'
import type { PngtuberState } from '@/shared/pngtuber/types'
import { usePngtuberRuntime } from '@/shared/pngtuber/usePngtuberRuntime'

const props = defineProps<{
  channelId?: string
  userId?: number
  noShadow?: boolean
}>()

const targetChannel = computed(() => resolveObsSyncChannel(props.channelId))

const bridge = useObsBridge<PngtuberState>({
  componentId: 'pngtuber',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: {} as PngtuberState,
  role: 'viewer',
})

const state = computed(() => {
  try {
    return normalizePngtuberState(bridge.state.value)
  } catch {
    return structuredClone(DEFAULT_PNGTUBER_STATE)
  }
})

const live = usePngtuberRuntime(bridge.userId, targetChannel, false)
</script>

<template>
  <div class="w-full h-full overflow-hidden">
    <PngtuberDisplay
      :state="state"
      :is-speaking="live.runtime.value.isSpeaking"
      :volume="live.runtime.value.volume"
      :expression-id="live.runtime.value.expressionId"
      :muted="live.runtime.value.muted"
      :away="live.runtime.value.away"
      :no-shadow="props.noShadow"
      inline-mode
    />
  </div>
</template>
