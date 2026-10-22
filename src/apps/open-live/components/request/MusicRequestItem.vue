<script setup lang="ts">
import { Dismiss16Filled, MusicNote2Play20Filled, PresenceBlocked16Regular } from '@vicons/fluent'
import { computed } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  music: SongsInfo
  fromName: string
  index: number
}>()

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'cancel'): void
  (e: 'block'): void
}>()

const platformTag = computed(() => {
  switch (props.music.from) {
    case SongFrom.Netease:
      return { label: '网易', variant: 'destructive' as const }
    case SongFrom.Kugou:
      return { label: '酷狗', variant: 'brand' as const }
    default:
      return null
  }
})
</script>

<template>
  <div
    class="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-card/60 hover:bg-card hover:border-brand/30 transition-colors"
  >
    <div class="flex items-center gap-2.5 min-w-0">
      <span
        class="inline-flex items-center justify-center font-bold w-6 h-6 rounded-full bg-brand/10 text-brand text-xs shrink-0 font-mono"
      >
        {{ index }}
      </span>

      <span class="font-medium text-sm text-foreground truncate max-w-[200px] sm:max-w-[320px]">
        {{ music.name }}
      </span>

      <Badge
        v-if="platformTag"
        :variant="platformTag.variant"
        class="text-[10px] px-1.5 py-0 h-4"
      >
        {{ platformTag.label }}
      </Badge>

      <span class="text-xs text-muted-foreground truncate hidden md:inline">
        {{ music.author?.join('/') }}
      </span>

      <span class="text-xs text-muted-foreground/80 shrink-0">
        点歌人: <span class="text-foreground font-medium">{{ fromName }}</span>
      </span>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
              @click="emit('play')"
            >
              <component
                :is="MusicNote2Play20Filled"
                class="h-4 w-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="text-xs"> 播放 </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
              @click="emit('block')"
            >
              <component
                :is="PresenceBlocked16Regular"
                class="h-4 w-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="text-xs"> 加入黑名单 </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              @click="emit('cancel')"
            >
              <component
                :is="Dismiss16Filled"
                class="h-4 w-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="text-xs"> 取消 </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>
