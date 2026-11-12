<script setup lang="ts">
import Mic24Filled from '@vicons/fluent/es/Mic24Filled'
import MicOff24Filled from '@vicons/fluent/es/MicOff24Filled'
import Next20Filled from '@vicons/fluent/es/Next20Filled'
import Pause20Filled from '@vicons/fluent/es/Pause20Filled'
import Play20Filled from '@vicons/fluent/es/Play20Filled'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useSpeechService } from '@/store/useSpeechService'

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
      class="fixed bottom-4 right-4 z-[9999] bg-popover border border-border rounded-lg py-1.5 px-3 shadow-lg max-w-[360px] flex items-center gap-2 animate-[slide-up_0.25s_ease]"
    >
      <div
        class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
        @click="goToPage"
      >
        <span
          class="inline-block size-2 rounded-full shrink-0"
          :class="{
            'bg-emerald-500 animate-pulse': speechState.isSpeaking && !isPaused,
            'bg-amber-500': isPaused,
            'bg-muted-foreground/40': !speechState.isSpeaking && !isPaused,
          }"
        />

        <span
          class="text-xs flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
          :class="{
            'text-foreground font-medium': speechState.isSpeaking,
            'text-muted-foreground': !speechState.isSpeaking,
          }"
        >
          {{ speechState.isSpeaking ? speechState.speakingText : isPaused ? '已暂停' : '待机' }}
        </span>

        <Badge
          v-if="queueCount > 0"
          variant="secondary"
          size="xs"
          class="min-w-[18px] px-1 justify-center"
        >
          {{ queueCount }}
        </Badge>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                :variant="isPaused ? 'default' : 'outline'"
                @click="speechService.togglePause()"
              >
                <component
                  :is="isPaused ? Play20Filled : Pause20Filled"
                  class="size-3.5"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{ isPaused ? '恢复朗读' : '暂停朗读' }}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="outline"
                :disabled="!speechState.isSpeaking"
                @click="speechService.skipCurrent()"
              >
                <Next20Filled class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent> 跳过当前 </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="destructive"
                @click="speechService.stopSpeech()"
              >
                <MicOff24Filled class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent> 停止朗读并清空 </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="ghost"
                class="text-muted-foreground"
                @click="goToPage"
              >
                <Mic24Filled class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent> 打开读弹幕页面 </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
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
