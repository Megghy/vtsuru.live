<script setup lang="ts">
import ArrowDown24Regular from '@vicons/fluent/es/ArrowDown24Regular'
import ArrowUp24Regular from '@vicons/fluent/es/ArrowUp24Regular'
import Dismiss16Filled from '@vicons/fluent/es/Dismiss16Filled'
import MusicNote2Play20Filled from '@vicons/fluent/es/MusicNote2Play20Filled'
import Pin24Filled from '@vicons/fluent/es/Pin24Filled'
import Pin24Regular from '@vicons/fluent/es/Pin24Regular'
import PresenceBlocked16Regular from '@vicons/fluent/es/PresenceBlocked16Regular'
import { computed } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import LiveQueueRowShell from '@/apps/open-live/components/shared/LiveQueueRowShell.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  music: ResponseSongModel
  fromName: string
  index: number
  isPinned?: boolean
  canBlockUser?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
}>()

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'cancel'): void
  (e: 'block-song'): void
  (e: 'block-user'): void
  (e: 'move-up'): void
  (e: 'move-down'): void
  (e: 'pin'): void
}>()

const platformTag = computed(() => {
  switch (props.music.from) {
    case SongPlatform.Netease:
      return { label: '网易云', variant: 'destructive' as const }
    case SongPlatform.Kugou:
      return { label: '酷狗', variant: 'outline' as const }
    default:
      return null
  }
})
</script>

<template>
  <LiveQueueRowShell :index="index">
    <template #primary>
      <span
        class="font-medium text-sm text-foreground truncate min-w-0"
        :title="music.name"
      >
        {{ music.name }}
      </span>
    </template>

    <template #context>
      <Badge
        v-if="isPinned"
        variant="brand"
        size="xs"
      >
        置顶
      </Badge>
      <Badge
        v-if="platformTag"
        :variant="platformTag.variant"
        size="xs"
      >
        {{ platformTag.label }}
      </Badge>
      <span
        v-if="music.author?.length"
        class="text-xs text-muted-foreground truncate min-w-0"
      >
        {{ music.author.join('/') }}
      </span>
      <span class="text-xs text-muted-foreground/80 shrink-0">
        点歌人: <span class="text-foreground font-medium">{{ fromName || '主播添加' }}</span>
      </span>
    </template>

    <template #actions>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              :variant="isPinned ? 'secondary' : 'ghost'"
              :class="isPinned ? 'text-primary' : undefined"
              :aria-label="isPinned ? '取消置顶' : '置顶'"
              @click="emit('pin')"
            >
              <Pin24Filled
                v-if="isPinned"
                class="size-3.5"
              />
              <Pin24Regular
                v-else
                class="size-3.5"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ isPinned ? '取消置顶' : '置顶到下一首' }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              :disabled="!canMoveUp"
              aria-label="上移"
              @click="emit('move-up')"
            >
              <ArrowUp24Regular class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>上移</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              :disabled="!canMoveDown"
              aria-label="下移"
              @click="emit('move-down')"
            >
              <ArrowDown24Regular class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>下移</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
              aria-label="立即播放"
              @click="emit('play')"
            >
              <MusicNote2Play20Filled class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>立即切播</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
              aria-label="屏蔽选项"
            >
              <PresenceBlocked16Regular class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="emit('block-song')"> 将歌曲名「{{ music.name }}」加入黑名单 </DropdownMenuItem>
            <DropdownMenuItem
              v-if="canBlockUser"
              class="text-destructive focus:text-destructive"
              @click="emit('block-user')"
            >
              拉黑观众「{{ fromName }}」并取消
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label="取消点歌"
              @click="emit('cancel')"
            >
              <Dismiss16Filled class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>取消点歌</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>
  </LiveQueueRowShell>
</template>
