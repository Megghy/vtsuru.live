<script setup lang="ts" generic="T extends { key: string }">
import { NButton, NVirtualList } from 'naive-ui'
import { nextTick, ref, watch } from 'vue'

import { useLiveDashboard } from '../store/useLiveDashboard'

/**
 * 面板列表：虚拟滚动 + 贴底跟随。
 * anchor=bottom 时新消息在底部（弹幕），用户上翻后暂停跟随并提示新消息数；
 * anchor=top 时列表已按新到旧排序（付费面板）。
 */
const props = defineProps<{ items: T[]; itemSize: number; anchor: 'top' | 'bottom' }>()
defineSlots<{ default: (props: { item: T }) => unknown }>()

const dashboard = useLiveDashboard()
const listRef = ref<InstanceType<typeof NVirtualList>>()
const following = ref(true)
const pending = ref(0)

function edge() {
  const position = props.anchor === 'bottom' ? 'bottom' : 'top'
  listRef.value?.scrollTo({ position })
  // 可变行高在渲染后才测量，下一帧再贴一次边
  requestAnimationFrame(() => following.value && listRef.value?.scrollTo({ position }))
}

// 只有用户主动滚动才会脱离跟随；虚拟列表测量行高引起的程序滚动不应打断
let userScrollAt = 0
function markUserScroll() {
  userScrollAt = Date.now()
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  const distance = props.anchor === 'bottom' ? el.scrollHeight - el.scrollTop - el.clientHeight : el.scrollTop
  if (distance < 24) {
    following.value = true
    pending.value = 0
  } else if (Date.now() - userScrollAt < 800) following.value = false
}

function resume() {
  following.value = true
  pending.value = 0
  edge()
}

watch(
  () => props.items,
  async (next, prev) => {
    if (following.value) {
      await nextTick()
      edge()
    } else if (prev && next.length > prev.length) pending.value += next.length - prev.length
  },
  { immediate: true },
)

watch(
  () => dashboard.scrollTarget,
  async (key) => {
    if (!key || !props.items.some((item) => item.key === key)) return
    following.value = false
    await nextTick()
    listRef.value?.scrollTo({ key })
    dashboard.scrollTarget = undefined
  },
)
</script>

<template>
  <div class="event-list">
    <NVirtualList
      ref="listRef"
      class="event-list__scroll"
      :items="items"
      :item-size="itemSize"
      item-resizable
      key-field="key"
      @scroll="onScroll"
      @wheel.passive="markUserScroll"
      @touchmove.passive="markUserScroll"
      @keydown="markUserScroll"
      @pointerdown="markUserScroll"
    >
      <template #default="{ item }">
        <slot :item="item as T" />
      </template>
    </NVirtualList>
    <div
      v-if="!items.length"
      class="event-list__empty"
    >
      暂无事件
    </div>
    <NButton
      v-if="!following"
      class="event-list__resume"
      size="tiny"
      round
      secondary
      @click="resume"
    >
      {{ pending ? `${pending} 条新事件` : anchor === 'bottom' ? '回到底部' : '回到顶部' }}
    </NButton>
  </div>
</template>

<style scoped>
.event-list {
  position: relative;
  height: 100%;
  min-height: 0;
}

.event-list__scroll {
  height: 100%;
}

.event-list__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--vtsuru-fg-disabled);
  font-size: 13px;
  pointer-events: none;
}

.event-list__resume {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  z-index: 2;
}
</style>
