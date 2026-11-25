<script setup lang="ts">
import { ArrowDown, ArrowUp, Ban, GripVertical, Pin, PinOff, Play, X } from 'lucide-vue-next'
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
  draggable?: boolean
  isDragging?: boolean
  isDragOver?: boolean
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
  <LiveQueueRowShell
    :index="index"
    :class="[
      isDragging && 'opacity-50',
      isDragOver && 'ring-1 ring-primary bg-primary/5',
      draggable && 'cursor-grab active:cursor-grabbing',
    ]"
  >
    <template #primary>
      <GripVertical
        v-if="draggable"
        class="size-3.5 text-muted-foreground/50 shrink-0 -ml-1"
      />
      <span
        class="font-medium text-xs text-foreground truncate min-w-0"
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
      <TooltipProvider :delay-duration="250">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              :variant="isPinned ? 'secondary' : 'ghost'"
              :class="isPinned ? 'text-primary' : undefined"
              :aria-label="isPinned ? '取消置顶' : '置顶'"
              @click="emit('pin')"
            >
              <PinOff
                v-if="isPinned"
                class="size-3.5"
              />
              <Pin
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
              <ArrowUp class="size-3.5" />
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
              <ArrowDown class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>下移</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              aria-label="立即播放"
              @click="emit('play')"
            >
              <Play class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>立即切播</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              aria-label="屏蔽选项"
            >
              <Ban class="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="emit('block-song')">将歌曲名「{{ music.name }}」加入黑名单</DropdownMenuItem>
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
              <X class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>取消点歌</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>
  </LiveQueueRowShell>
</template>
