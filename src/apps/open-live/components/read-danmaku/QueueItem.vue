<script setup lang="ts">
import { ArrowUp20Filled, Copy20Filled, Delete20Filled, Play20Filled, ReOrder24Filled } from '@vicons/fluent'
import { useTimeAgo } from '@vueuse/core'
import { computed } from 'vue'

import { EventDataTypes } from '@/api/api-models'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Tag } from '@/shared/ui/tag'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { copyToClipboard } from '@/shared/utils'
import { useSpeechService } from '@/store/useSpeechService'
import type { QueueItem } from '@/store/useSpeechService'

const props = defineProps<{
  item: QueueItem
  index: number
}>()
defineEmits<{ (e: 'dragstart', index: number): void }>()

const speechService = useSpeechService()
const { settings } = speechService

const tag = computed(() => {
  switch (props.item.data.type) {
    case EventDataTypes.Message:
      return { text: '弹幕', type: 'info' as const }
    case EventDataTypes.Gift:
      return { text: '礼物', type: 'success' as const }
    case EventDataTypes.Guard:
      return { text: '舰长', type: 'warning' as const }
    case EventDataTypes.SC:
      return { text: 'SC', type: 'error' as const }
    case EventDataTypes.Enter:
      return { text: '进入', type: 'default' as const }
    default:
      return { text: '未知', type: 'default' as const }
  }
})

const timeAgo = useTimeAgo(() => props.item.data.time, {
  showSecond: true,
  messages: {
    justNow: '刚刚',
    past: (n) => (n.match(/\d/) ? `${n} 前` : n),
    future: (n) => (n.match(/\d/) ? `${n} 后` : n),
    month: (n, p) => (p ? '上个月' : `${n} 个月`),
    year: (n, p) => (p ? '去年' : `${n} 年`),
    day: (n, p) => (p ? '昨天' : `${n} 天`),
    week: (n, p) => (p ? '上周' : `${n} 周`),
    hour: (n) => `${n} 小时`,
    minute: (n) => `${n} 分钟`,
    second: (n) => `${n} 秒`,
    invalid: '',
  },
})

const absoluteTime = computed(() => {
  const d = new Date(props.item.data.time)
  return d.toLocaleTimeString('zh-CN', { hour12: false })
})

const speechText = computed(() => speechService.getTextFromDanmaku(props.item.data) ?? '')

function handleSelect(action: string) {
  switch (action) {
    case 'play':
      speechService.forceSpeak(props.item.data)
      break
    case 'pin':
      speechService.pinToTop(props.item)
      break
    case 'copy':
      copyToClipboard(speechText.value)
      break
    case 'remove':
      speechService.removeFromQueue(props.item)
      break
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <div
        class="queue-item"
        :draggable="true"
        @dragstart="$emit('dragstart', index)"
      >
        <div
          class="drag-handle"
          @click.stop
        >
          <ReOrder24Filled class="size-3.5" />
        </div>

        <Tag
          :type="tag.type"
          class="type-tag text-[10px] px-1 py-0 h-5"
        >
          {{ tag.text }}
        </Tag>

        <span class="uname">{{ item.data.uname }}</span>

        <span class="content text-muted-foreground">
          {{ speechText }}
        </span>

        <Tag
          v-if="item.data.type === EventDataTypes.Gift && item.combineCount"
          type="info"
          class="text-[10px] px-1 py-0 h-4"
        >
          ×{{ item.combineCount }}
        </Tag>
        <Tag
          v-else-if="item.data.type === EventDataTypes.Gift && settings.combineGiftDelay"
          type="success"
          class="text-[10px] px-1 py-0 h-4"
        >
          合并中
        </Tag>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="time">{{ timeAgo }}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p class="text-xs">{{ absoluteTime }}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div
          class="actions"
          @click.stop
        >
          <Button variant="ghost" class="h-6 w-6 p-0 rounded-full" @click="speechService.forceSpeak(item.data)">
            <Play20Filled class="size-3.5" />
          </Button>
          <Button variant="ghost" class="h-6 w-6 p-0 rounded-full text-destructive hover:bg-destructive/10" @click="speechService.removeFromQueue(item)">
            <Delete20Filled class="size-3.5" />
          </Button>
        </div>
      </div>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-36 text-xs">
      <DropdownMenuItem @click="handleSelect('play')">
        <Play20Filled class="size-3.5 mr-2" />
        立即播放
      </DropdownMenuItem>
      <DropdownMenuItem @click="handleSelect('pin')">
        <ArrowUp20Filled class="size-3.5 mr-2" />
        置顶
      </DropdownMenuItem>
      <DropdownMenuItem @click="handleSelect('copy')">
        <Copy20Filled class="size-3.5 mr-2" />
        复制内容
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        class="text-destructive"
        @click="handleSelect('remove')"
      >
        <Delete20Filled class="size-3.5 mr-2" />
        从队列移除
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<style scoped>
.queue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--card);
  font-size: 12px;
  cursor: grab;
  user-select: none;
  transition:
    border-color 120ms ease,
    background 120ms ease;
}
.queue-item:hover {
  border-color: var(--primary);
}
.queue-item:active {
  cursor: grabbing;
}
.drag-handle {
  color: var(--muted-foreground);
  display: flex;
  align-items: center;
}
.type-tag {
  flex-shrink: 0;
}
.uname {
  font-weight: 600;
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.content {
  flex: 1;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.time {
  font-size: 11px;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
</style>
