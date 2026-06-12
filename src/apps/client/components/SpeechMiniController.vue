<script setup lang="ts">
import { Mic24Filled, MicOff24Filled, Next20Filled, Pause20Filled, Play20Filled } from '@vicons/fluent'
import { NButton, NFlex, NIcon, NText, NTooltip, useThemeVars } from 'naive-ui'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSpeechService } from '@/store/useSpeechService'

const router = useRouter()
const route = useRoute()
const speechService = useSpeechService()
const { speechState, speakQueue, isPaused } = speechService
const themeVars = useThemeVars()

const isActive = computed(() => speechState.canSpeech && route.name !== 'client-read-danmaku')
const queueCount = computed(() => speakQueue.value.length)
const containerStyle = computed(() => ({
  '--mini-bg': themeVars.value.popoverColor,
  '--mini-border': themeVars.value.borderColor,
  '--mini-badge-bg': themeVars.value.actionColor,
}))

function goToPage() {
  router.push({ name: 'client-read-danmaku' })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isActive" class="speech-mini-controller" :style="containerStyle">
      <NFlex align="center" :size="8" :wrap="false" style="flex: 1; overflow: hidden;">
        <NTooltip>
          <template #trigger>
            <NButton size="tiny" quaternary @click="goToPage">
              <template #icon>
                <NIcon :component="Mic24Filled" color="#18a058" />
              </template>
            </NButton>
          </template>
          前往读弹幕页面
        </NTooltip>

        <NText class="status-text" :type="speechState.isSpeaking ? 'success' : isPaused ? 'warning' : 'default'">
          {{ speechState.isSpeaking ? speechState.speakingText : isPaused ? '已暂停' : '待机' }}
        </NText>

        <NText v-if="queueCount > 0" depth="3" class="queue-badge">
          {{ queueCount }}
        </NText>
      </NFlex>
      <NFlex :size="4" :wrap="false">
        <NButton size="tiny" :type="isPaused ? 'warning' : 'default'" @click="speechService.togglePause()">
          <template #icon>
            <NIcon :component="isPaused ? Play20Filled : Pause20Filled" />
          </template>
        </NButton>
        <NButton size="tiny" :disabled="!speechState.isSpeaking" @click="speechService.skipCurrent()">
          <template #icon>
            <NIcon :component="Next20Filled" />
          </template>
        </NButton>
        <NButton size="tiny" type="error" @click="speechService.stopSpeech()">
          <template #icon>
            <NIcon :component="MicOff24Filled" />
          </template>
        </NButton>
      </NFlex>
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
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
