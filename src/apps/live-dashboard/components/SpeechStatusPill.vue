<script setup lang="ts">
import { Mic, Pause, Play, SkipForward, Square } from 'lucide-vue-next'
import { computed } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { SimpleTooltip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useSpeechService } from '@/store/useSpeechService'

const speechService = useSpeechService()
const { speechState, speakQueue, isPaused } = speechService

const queueCount = computed(() => speakQueue.value.length)
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div
      v-if="speechState.canSpeech"
      class="flex items-center gap-0.5 h-7 pl-1.5 pr-0.5 rounded-md border border-border bg-muted/60 shrink-0"
    >
      <Popover>
        <SimpleTooltip
          :content="
            speechState.isSpeaking
              ? `正在朗读：${speechState.speakingText}`
              : isPaused
                ? '语音播报已暂停（点击展开控制）'
                : '语音播报待机中（点击展开控制）'
          "
        >
          <PopoverTrigger as-child>
            <button
              type="button"
              class="flex items-center gap-1.5 px-1 h-6 rounded hover:bg-accent/60 transition-colors cursor-pointer border-0 bg-transparent text-foreground"
              aria-label="展开语音播报详情"
            >
              <span
                class="size-2 rounded-full shrink-0"
                :class="{
                  'bg-emerald-500 animate-pulse': speechState.isSpeaking && !isPaused,
                  'bg-amber-500': isPaused,
                  'bg-muted-foreground/40': !speechState.isSpeaking && !isPaused,
                }"
              />
              <Mic class="size-3.5 shrink-0 text-muted-foreground 2xl:hidden" />
              <span class="hidden 2xl:inline text-xs truncate max-w-[120px]">
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
            </button>
          </PopoverTrigger>
        </SimpleTooltip>

        <PopoverContent
          align="end"
          class="w-64 p-3 space-y-2.5 text-xs"
        >
          <div class="flex-between">
            <span class="font-semibold text-foreground">语音读弹幕</span>
            <Badge
              v-if="queueCount > 0"
              size="xs"
              variant="secondary"
              class="tabular-nums"
            >
              排队 {{ queueCount }}
            </Badge>
          </div>

          <div class="rounded-md bg-muted/60 px-2.5 py-2 text-muted-foreground leading-relaxed break-words">
            {{ speechState.isSpeaking ? speechState.speakingText : isPaused ? '已暂停朗读' : '当前无朗读任务，等待新弹幕...' }}
          </div>

          <div class="grid grid-cols-3 gap-1.5">
            <Button
              size="xs"
              variant="outline"
              class="gap-1"
              @click="speechService.togglePause()"
            >
              <component
                :is="isPaused ? Play : Pause"
                class="size-3.5"
              />
              <span>{{ isPaused ? '恢复' : '暂停' }}</span>
            </Button>
            <Button
              size="xs"
              variant="outline"
              class="gap-1"
              :disabled="!speechState.isSpeaking"
              @click="speechService.skipCurrent()"
            >
              <SkipForward class="size-3.5" />
              <span>跳过</span>
            </Button>
            <Button
              size="xs"
              variant="ghost"
              class="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              @click="speechService.stopSpeech()"
            >
              <Square class="size-3" />
              <span>停止</span>
            </Button>
          </div>
        </PopoverContent>
      </Popover>

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
            class="hidden xl:inline-flex size-6"
            :disabled="!speechState.isSpeaking"
            aria-label="跳过当前朗读"
            @click="speechService.skipCurrent()"
          >
            <SkipForward class="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>跳过当前</TooltipContent>
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
          <Mic class="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>开启语音读弹幕</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
