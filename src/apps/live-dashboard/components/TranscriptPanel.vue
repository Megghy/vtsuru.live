<script setup lang="ts">
import { MicOff } from 'lucide-vue-next'
import { defineAsyncComponent } from 'vue'

import { isTauri } from '@/shared/config'

import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()

const inTauri = isTauri()
const ClientTranscriptPane = defineAsyncComponent(() => import('./ClientTranscriptPane.vue'))
</script>

<template>
  <PanelShell
    title="语音转写"
    panel-id="transcript"
    :blurred="blurred"
  >
    <ClientTranscriptPane v-if="inTauri" />
    <div
      v-else
      class="flex-col-center h-full p-4 text-center text-xs text-muted-foreground gap-1.5"
    >
      <MicOff class="size-5 opacity-40" />
      <span>实时语音转写字幕流仅在桌面客户端中可用</span>
    </div>
  </PanelShell>
</template>
