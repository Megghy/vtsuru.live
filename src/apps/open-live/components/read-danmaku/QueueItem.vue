<script setup lang="ts">
const Play20Filled = 'i-lucide-circle'
const ArrowUp20Filled = 'i-lucide-circle'
const Copy20Filled = 'i-lucide-circle'
const Delete20Filled = 'i-lucide-circle'
import { useTimeAgo } from '@vueuse/core'
import { computed, h, resolveComponent } from 'vue'

import { EventDataTypes } from '@/api/api-models'
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

const dropdownOptions = computed(() => [
  {
    label: '立即播放',
    key: 'play',
    icon: () => h(resolveComponent('UIcon'), null, { default: () => h(Play20Filled) }),
  },
  { label: '置顶', key: 'pin', icon: () => h(resolveComponent('UIcon'), null, { default: () => h(ArrowUp20Filled) }) },
  {
    label: '复制内容',
    key: 'copy',
    icon: () => h(resolveComponent('UIcon'), null, { default: () => h(Copy20Filled) }),
  },
  { type: 'separator' as const },
  {
    label: '从队列移除',
    key: 'remove',
    icon: () => h(resolveComponent('UIcon'), null, { default: () => h(Delete20Filled) }),
  },
])

function handleSelect(key: string) {
  switch (key) {
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
  <UDropdownMenu
    trigger="click"
    placement="bottom-start"
    :items="dropdownOptions"
    @select="handleSelect"
  >
    <div
      class="queue-item"
      :draggable="true"
      @dragstart="$emit('dragstart', index)"
    >
      <div
        class="drag-handle"
        @click.stop
      >
        <UIcon
          name="i-lucide-circle"
          :size="14"
        />
      </div>

      <UBadge
        :type="tag.type"
        size="small"
        :bordered="false"
        class="type-tag"
      >
        {{ tag.text }}
      </UBadge>

      <span class="uname">{{ item.data.uname }}</span>

      <span
        depth="3"
        class="content"
      >
        {{ speechText }}
      </span>

      <UBadge
        v-if="item.data.type === EventDataTypes.Gift && item.combineCount"
        type="info"
        size="tiny"
        :bordered="false"
      >
        ×{{ item.combineCount }}
      </UBadge>
      <UBadge
        v-else-if="item.data.type === EventDataTypes.Gift && settings.combineGiftDelay"
        type="success"
        size="tiny"
        :bordered="false"
      >
        合并中
      </UBadge>

      <UTooltip>
        <span class="time">{{ timeAgo }}</span>
        <template #content>
          {{ absoluteTime }}
        </template>
      </UTooltip>

      <div
        class="actions"
        @click.stop
      >
        <UButton
          size="tiny"
          variant="soft"
          square
          @click="speechService.forceSpeak(item.data)"
        >
          <template #leading>
            <UIcon name="i-lucide-circle" />
          </template>
        </UButton>
        <UButton
          size="tiny"
          variant="soft"
          square
          @click="speechService.removeFromQueue(item)"
        >
          <template #leading>
            <UIcon name="i-lucide-circle" />
          </template>
        </UButton>
      </div>
    </div>
  </UDropdownMenu>
</template>

<style scoped>
.queue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  background: var(--vtsuru-bg-surface);
  font-size: 12px;
  cursor: grab;
  user-select: none;
  transition:
    border-color 120ms ease,
    background 120ms ease;
}
.queue-item:hover {
  border-color: var(--vtsuru-primary);
}
.queue-item:active {
  cursor: grabbing;
}
.drag-handle {
  color: var(--vtsuru-fg-muted);
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
  color: var(--vtsuru-fg-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
</style>
