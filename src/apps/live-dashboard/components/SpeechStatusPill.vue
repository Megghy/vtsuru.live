<script setup lang="ts">
import { Mic, Pause, Play, SkipForward, Square } from 'lucide-vue-next'
import { computed } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useSpeechService } from '@/store/useSpeechService'

const speechService = useSpeechService()
const { speechState, speakQueue, isPaused } = speechService

const queueCount = computed(() => speakQueue.value.length)
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div
      v-if="speechState.canSpeech"
      class="flex items-center gap-1 h-7 px-1.5 rounded-md border border-border bg-muted/60 shrink-0"
    >
      <Tooltip>
        <TooltipTrigger as-child>
          <div class="flex items-center gap-1.5 px-1 max-w-[140px] cursor-default">
            <span
              class="size-2 rounded-full shrink-0"
              :class="{
                'bg-emerald-500 animate-pulse': speechState.isSpeaking && !isPaused,
                'bg-amber-500': isPaused,
                'bg-muted-foreground/40': !speechState.isSpeaking && !isPaused,
              }"
            />
            <span class="text-xs truncate">
              {{ speechState.isSpeaking ? speechState.speakingText : isPaused ? '朗读暂停' : '语音待机' }}
            </span>
            <Badge
              v-if="queueCount > 0"
              size="xs"
              variant="secondary"
              class="px-1 tabular-nums"
            >
              {{ queueCount }}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {{ speechState.isSpeaking ? `正在朗读：${speechState.speakingText}` : '语音播报队列状态' }}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            size="icon-xs"
            variant="ghost"
            class="size-6"
            :aria-label="isPaused ? '恢复朗读' : '暂停朗读'"
            @click="speechService.togglePause()"
          >
            <component
              :is="isPaused ? Play : Pause"
              class="size-3.5"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ isPaused ? '恢复朗读' : '暂停朗读' }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            size="icon-xs"
            variant="ghost"
            class="size-6"
            :disabled="!speechState.isSpeaking"
            aria-label="跳过当前朗读"
            @click="speechService.skipCurrent()"
          >
            <SkipForward class="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>跳过当前</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            size="icon-xs"
            variant="ghost"
            class="size-6 text-muted-foreground hover:text-destructive"
            aria-label="停止朗读并清空"
            @click="speechService.stopSpeech()"
          >
            <Square class="size-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>停止朗读并清空队列</TooltipContent>
      </Tooltip>
    </div>

    <Tooltip v-else>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon-xs"
          class="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="开启语音读弹幕"
          @click="speechService.startSpeech()"
        >
          <Mic class="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>开启语音读弹幕</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
