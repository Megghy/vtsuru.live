<script setup lang="ts">
import {
  ArrowUp20Filled, Copy20Filled, Delete20Filled, Play20Filled, ReOrder24Filled,
} from '@vicons/fluent'
import {
  NButton, NDropdown, NIcon, NTag, NText, NTooltip,
} from 'naive-ui'
import { computed, h  } from 'vue'
import { useTimeAgo } from '@vueuse/core'
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
    case EventDataTypes.Message: return { text: '弹幕', type: 'info' as const }
    case EventDataTypes.Gift: return { text: '礼物', type: 'success' as const }
    case EventDataTypes.Guard: return { text: '舰长', type: 'warning' as const }
    case EventDataTypes.SC: return { text: 'SC', type: 'error' as const }
    case EventDataTypes.Enter: return { text: '进入', type: 'default' as const }
    default: return { text: '未知', type: 'default' as const }
  }
})

const timeAgo = useTimeAgo(() => props.item.data.time, {
  showSecond: true,
  messages: {
    justNow: '刚刚',
    past: n => n.match(/\d/) ? `${n} 前` : n,
    future: n => n.match(/\d/) ? `${n} 后` : n,
    month: (n, p) => p ? '上个月' : `${n} 个月`,
    year: (n, p) => p ? '去年' : `${n} 年`,
    day: (n, p) => p ? '昨天' : `${n} 天`,
    week: (n, p) => p ? '上周' : `${n} 周`,
    hour: n => `${n} 小时`,
    minute: n => `${n} 分钟`,
    second: n => `${n} 秒`,
    invalid: '',
  },
})

const absoluteTime = computed(() => {
  const d = new Date(props.item.data.time)
  return d.toLocaleTimeString('zh-CN', { hour12: false })
})

const speechText = computed(() => speechService.getTextFromDanmaku(props.item.data) ?? '')

const dropdownOptions = computed(() => [
  { label: '立即播放', key: 'play', icon: () => h(NIcon, null, { default: () => h(Play20Filled) }) },
  { label: '置顶', key: 'pin', icon: () => h(NIcon, null, { default: () => h(ArrowUp20Filled) }) },
  { label: '复制内容', key: 'copy', icon: () => h(NIcon, null, { default: () => h(Copy20Filled) }) },
  { type: 'divider', key: 'd1' },
  { label: '从队列移除', key: 'remove', icon: () => h(NIcon, null, { default: () => h(Delete20Filled) }) },
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
  <NDropdown
    trigger="click"
    placement="bottom-start"
    :options="dropdownOptions"
    @select="handleSelect"
  >
    <div class="queue-item" :draggable="true" @dragstart="$emit('dragstart', index)">
      <div class="drag-handle" @click.stop>
        <NIcon :component="ReOrder24Filled" :size="14" />
      </div>

      <NTag :type="tag.type" size="small" :bordered="false" class="type-tag">
        {{ tag.text }}
      </NTag>

      <span class="uname">{{ item.data.uname }}</span>

      <NText depth="3" class="content">
        {{ speechText }}
      </NText>

      <NTag
        v-if="item.data.type === EventDataTypes.Gift && item.combineCount"
        type="info" size="tiny" :bordered="false"
      >
        ×{{ item.combineCount }}
      </NTag>
      <NTag
        v-else-if="item.data.type === EventDataTypes.Gift && settings.combineGiftDelay"
        type="success" size="tiny" :bordered="false"
      >
        合并中
      </NTag>

      <NTooltip>
        <template #trigger>
          <span class="time">{{ timeAgo }}</span>
        </template>
        {{ absoluteTime }}
      </NTooltip>

      <div class="actions" @click.stop>
        <NButton size="tiny" tertiary circle @click="speechService.forceSpeak(item.data)">
          <template #icon>
            <NIcon :component="Play20Filled" />
          </template>
        </NButton>
        <NButton size="tiny" tertiary circle @click="speechService.removeFromQueue(item)">
          <template #icon>
            <NIcon :component="Delete20Filled" />
          </template>
        </NButton>
      </div>
    </div>
  </NDropdown>
</template>

<style scoped>
.queue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--n-divider-color);
  border-radius: 6px;
  background: var(--n-card-color);
  font-size: 12px;
  cursor: grab;
  user-select: none;
  transition: border-color 120ms ease, background 120ms ease;
}
.queue-item:hover {
  border-color: var(--n-primary-color);
}
.queue-item:active {
  cursor: grabbing;
}
.drag-handle {
  color: var(--n-text-color-3);
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
  color: var(--n-text-color-3);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
</style>
