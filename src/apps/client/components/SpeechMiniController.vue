<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSpeechService } from '@/store/useSpeechService'

const router = useRouter()
const route = useRoute()
const speechService = useSpeechService()
const { speechState, speakQueue, isPaused } = speechService

const isActive = computed(() => speechState.canSpeech && route.name !== 'client-read-danmaku')
const queueCount = computed(() => speakQueue.value.length)
const containerStyle = computed(() => ({
  '--mini-bg': 'var(--vtsuru-bg-elevated)',
  '--mini-border': 'var(--vtsuru-border)',
  '--mini-badge-bg': 'var(--vtsuru-bg-muted)',
}))

function goToPage() {
  router.push({ name: 'client-read-danmaku' })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isActive"
      class="speech-mini-controller"
      :style="containerStyle"
    >
      <div
        align="center"
        :size="8"
        :wrap="false"
        style="flex: 1; overflow: hidden"
      >
        <UTooltip>
          <UButton
            size="tiny"
            variant="ghost"
            @click="goToPage"
          >
            <template #leading>
              <UIcon
                name="i-lucide-circle"
                color="#18a058"
              />
            </template>
          </UButton>
          <template #content> 前往读弹幕页面 </template>
        </UTooltip>

        <span
          class="status-text"
          :type="speechState.isSpeaking ? 'success' : isPaused ? 'warning' : 'default'"
        >
          {{ speechState.isSpeaking ? speechState.speakingText : isPaused ? '已暂停' : '待机' }}
        </span>

        <span
          v-if="queueCount > 0"
          depth="3"
          class="queue-badge"
        >
          {{ queueCount }}
        </span>
      </div>
      <div
        :size="4"
        :wrap="false"
      >
        <UButton
          size="tiny"
          :color="isPaused ? 'warning' : 'neutral'"
          @click="speechService.togglePause()"
        >
          <template #leading>
            <UIcon name="i-lucide-circle" />
          </template>
        </UButton>
        <UButton
          size="tiny"
          :disabled="!speechState.isSpeaking"
          @click="speechService.skipCurrent()"
        >
          <template #leading>
            <UIcon name="i-lucide-circle" />
          </template>
        </UButton>
        <UButton
          size="tiny"
          color="error"
          @click="speechService.stopSpeech()"
        >
          <template #leading>
            <UIcon name="i-lucide-circle" />
          </template>
        </UButton>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.speech-mini-controller {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 9999;
  background: var(--mini-bg);
  border: 1px solid var(--mini-border);
  border-radius: 8px;
  padding: 6px 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  max-width: 360px;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: slide-up 0.25s ease;
}
.status-text {
  font-size: 12px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.queue-badge {
  font-size: 11px;
  background: var(--mini-badge-bg);
  border-radius: 10px;
  padding: 0 6px;
  min-width: 18px;
  text-align: center;
}
@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
