<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useObsBridge } from '@/apps/obs-store/sync'

import PngtuberDisplay from './PngtuberDisplay.vue'
import { DEFAULT_PNGTUBER_STATE, sanitizePngtuberState } from './types'
import { useAudioReactive } from './useAudioReactive'

const route = useRoute()
const channelId = (route.query.channel as string) || 'default'

const { state } = useObsBridge({
  componentId: 'pngtuber',
  channelId,
  defaultState: DEFAULT_PNGTUBER_STATE,
  role: 'viewer',
})

const viewState = computed(() => sanitizePngtuberState(state.value))

const { isSpeaking } = useAudioReactive({
  threshold: computed(() => viewState.value.threshold),
  gain: computed(() => viewState.value.gain),
  releaseDelay: computed(() => viewState.value.releaseDelay),
  autoStart: true,
})
</script>

<template>
  <PngtuberDisplay
    :state="viewState"
    :is-speaking="isSpeaking"
  />
</template>
