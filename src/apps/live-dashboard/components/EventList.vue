<script setup lang="ts" generic="T extends { key: string }">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/shared/ui/button'

import { useLiveDashboard } from '../store/useLiveDashboard'

/**
 * 面板列表：动态高度虚拟滚动 + 贴底/贴顶跟随。
 * anchor=bottom 时新消息在底部（弹幕），用户上翻后暂停跟随并提示新消息数；
 * anchor=top 时列表已按新到旧排序（付费面板）。
 */
const props = defineProps<{ items: T[]; itemSize: number; anchor: 'top' | 'bottom' }>()
defineSlots<{ default: (props: { item: T }) => unknown }>()

const OVERSCAN = 6

const dashboard = useLiveDashboard()
const listRef = ref<HTMLElement>()
const following = ref(true)
const pending = ref(0)
const scrollTop = ref(0)
const viewportHeight = ref(600)
const measureVersion = ref(0)

const heights = new Map<string, number>()
const elToKey = new WeakMap<Element, string>()
let pendingMeasureBump = false
let resizeObserver: ResizeObserver | undefined
let viewportObserver: ResizeObserver | undefined

function scheduleMeasureBump() {
  if (pendingMeasureBump) return
  pendingMeasureBump = true
  requestAnimationFrame(() => {
    pendingMeasureBump = false
    measureVersion.value++
    if (following.value) edge()
  })
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver((entries) => {
    let changed = false
    for (const entry of entries) {
      const key = elToKey.get(entry.target)
      if (!key) continue
      const h = Math.ceil((entry.target as HTMLElement).offsetHeight)
      if (h > 0 && heights.get(key) !== h) {
        heights.set(key, h)
        changed = true
      }
    }
    if (changed) scheduleMeasureBump()
  })
  if (listRef.value) {
    viewportHeight.value = listRef.value.clientHeight || 600
    viewportObserver = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (h && h > 0) {
        viewportHeight.value = h
        if (following.value) edge()
      }
    })
    viewportObserver.observe(listRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  viewportObserver?.disconnect()
})

const vMeasure = {
  mounted(el: HTMLElement, binding: { value: string }) {
    elToKey.set(el, binding.value)
    const h = el.offsetHeight
    if (h > 0 && heights.get(binding.value) !== h) {
      heights.set(binding.value, h)
      scheduleMeasureBump()
    }
    resizeObserver?.observe(el)
  },
  updated(el: HTMLElement, binding: { value: string }) {
    elToKey.set(el, binding.value)
  },
  beforeUnmount(el: HTMLElement) {
    resizeObserver?.unobserve(el)
  },
}

const layout = computed(() => {
  void measureVersion.value
  const list = props.items
  const offsets = new Float64Array(list.length + 1)
  for (let i = 0; i < list.length; i++) {
    offsets[i + 1] = offsets[i] + (heights.get(list[i].key) ?? props.itemSize)
  }
  return { offsets, totalHeight: offsets[list.length] }
})

function findStartIndex(offsets: Float64Array, target: number): number {
  let lo = 0
  let hi = offsets.length - 2
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid + 1] <= target) lo = mid + 1
    else hi = mid - 1
  }
  return Math.max(0, lo)
}

const windowRange = computed(() => {
  const len = props.items.length
  if (!len) return { start: 0, end: 0, padTop: 0, padBottom: 0 }
  const { offsets, totalHeight } = layout.value
  const top = Math.max(0, scrollTop.value)
  const bottom = top + viewportHeight.value
  const rawStart = findStartIndex(offsets, top)
  const rawEnd = findStartIndex(offsets, bottom) + 1
  const start = Math.max(0, rawStart - OVERSCAN)
  const end = Math.min(len, rawEnd + OVERSCAN)
  return {
    start,
    end,
    padTop: offsets[start],
    padBottom: Math.max(0, totalHeight - offsets[end]),
  }
})

const visibleItems = computed(() => props.items.slice(windowRange.value.start, windowRange.value.end))

function edge() {
  if (!listRef.value) return
  const target = props.anchor === 'bottom' ? listRef.value.scrollHeight : 0
  listRef.value.scrollTop = target
  scrollTop.value = listRef.value.scrollTop
  requestAnimationFrame(() => {
    if (following.value && listRef.value) {
      listRef.value.scrollTop = props.anchor === 'bottom' ? listRef.value.scrollHeight : 0
      scrollTop.value = listRef.value.scrollTop
    }
  })
}

// 只有用户主动滚动才会脱离跟随；虚拟列表测量行高引起的程序滚动不应打断
let userScrollAt = 0
function markUserScroll() {
  userScrollAt = Date.now()
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  scrollTop.value = el.scrollTop
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
    if (next.length === 0) heights.clear()
    if (following.value) {
      await nextTick()
      edge()
    } else if (prev && next.length > prev.length) {
      pending.value += next.length - prev.length
    }
  },
  { immediate: true },
)

watch(
  () => dashboard.scrollTarget,
  async (key) => {
    if (!key) return
    const idx = props.items.findIndex((item) => item.key === key)
    if (idx === -1) return
    following.value = false
    if (listRef.value) {
      const approxTop = Math.max(0, layout.value.offsets[idx] - viewportHeight.value / 2)
      listRef.value.scrollTop = approxTop
      scrollTop.value = approxTop
    }
    await nextTick()
    const el = listRef.value?.querySelector(`[data-event-key="${key}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    dashboard.scrollTarget = undefined
  },
)
</script>

<template>
  <div class="relative h-full min-h-0">
    <div
      ref="listRef"
      class="h-full overflow-y-auto scrollbar-thin"
      @scroll="onScroll"
      @wheel.passive="markUserScroll"
      @touchmove.passive="markUserScroll"
      @keydown="markUserScroll"
      @pointerdown="markUserScroll"
    >
      <div
        :style="{
          paddingTop: `${windowRange.padTop}px`,
          paddingBottom: `${windowRange.padBottom}px`,
        }"
      >
        <div
          v-for="item in visibleItems"
          :key="item.key"
          v-measure="item.key"
          class="flow-root"
          :data-event-key="item.key"
        >
          <slot :item="item as T" />
        </div>
      </div>
    </div>
    <div
      v-if="!items.length"
      class="absolute inset-0 grid place-items-center text-muted-foreground text-[13px] pointer-events-none"
    >
      暂无事件
    </div>
    <Button
      v-if="!following"
      class="absolute left-1/2 bottom-2 -translate-x-1/2 z-2 rounded-full shadow-md"
      variant="secondary"
      @click="resume"
    >
      {{ pending ? `${pending} 条新事件` : anchor === 'bottom' ? '回到底部' : '回到顶部' }}
    </Button>
  </div>
</template>
