<script setup lang="ts">
import { Mic24Filled, MicOff24Filled, Next20Filled, Pause20Filled, Play20Filled } from '@vicons/fluent'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSpeechService } from '@/store/useSpeechService'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const router = useRouter()
const route = useRoute()
const speechService = useSpeechService()
const { speechState, speakQueue, isPaused } = speechService

const isActive = computed(() => speechState.canSpeech && route.name !== 'client-read-danmaku')
const queueCount = computed(() => speakQueue.value.length)

function goToPage() {
  router.push({ name: 'client-read-danmaku' })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isActive"
      class="speech-mini-controller"
    >
      <div class="flex items-center gap-2 flex-1 overflow-hidden">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-6 w-6 p-0"
                @click="goToPage"
              >
                <component
                  :is="Mic24Filled"
                  class="w-4 h-4 text-emerald-500"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              前往读弹幕页面
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <span
          class="status-text font-medium"
          :class="{
            'text-emerald-500': speechState.isSpeaking,
            'text-amber-500': isPaused,
            'text-[var(--foreground)]': !speechState.isSpeaking && !isPaused
          }"
        >
          {{ speechState.isSpeaking ? speechState.speakingText : isPaused ? '已暂停' : '待机' }}
        </span>

        <span
          v-if="queueCount > 0"
          class="queue-badge"
        >
          {{ queueCount }}
        </span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <Button
          size="icon"
          :variant="isPaused ? 'default' : 'outline'"
          class="h-6 w-6 p-0"
          @click="speechService.togglePause()"
        >
          <component
            :is="isPaused ? Play20Filled : Pause20Filled"
            class="w-3.5 h-3.5"
          />
        </Button>
        <Button
          size="icon"
          variant="outline"
          class="h-6 w-6 p-0"
          :disabled="!speechState.isSpeaking"
          @click="speechService.skipCurrent()"
        >
          <component
            :is="Next20Filled"
            class="w-3.5 h-3.5"
          />
        </Button>
        <Button
          size="icon"
          variant="destructive"
          class="h-6 w-6 p-0"
          @click="speechService.stopSpeech()"
        >
          <component
            :is="MicOff24Filled"
            class="w-3.5 h-3.5"
          />
        </Button>
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
  background: var(--popover, #242428);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
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
  background: var(--muted, rgba(255, 255, 255, 0.08));
  color: var(--muted-foreground, #9ca3af);
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
