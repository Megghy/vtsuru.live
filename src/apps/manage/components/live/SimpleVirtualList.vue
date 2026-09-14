<script setup lang="ts">
import type { ScrollbarInst } from 'naive-ui/es/_internal'
import { NScrollbar } from 'naive-ui/es/_internal'
import type { PropType } from 'vue'
import { computed, onMounted, ref } from 'vue'
import type { VirtualListInst } from 'vueuc'
import { VVirtualList } from 'vueuc'
import type { ItemData } from 'vueuc/lib/virtual-list/src/type'

const props = defineProps({
  items: {
    type: Array as PropType<ItemData[]>,
    default: () => [],
  },
  defaultSize: {
    type: Number,
    required: true,
  },
  defaultHeight: {
    type: [Number, String],
    required: true,
  },
  scrollToEndDefault: {
    type: Boolean,
  },
})
const scrollerInstRef = ref<ScrollbarInst | null>(null)
const vlInstRef = ref<VirtualListInst | null>(null)

function scrollContainer(): HTMLElement | null {
  const { value } = vlInstRef
  if (!value) return null
  const { listElRef } = value
  return listElRef
}
function scrollContent(): HTMLElement | null {
  const { value } = vlInstRef
  if (!value) return null
  const { itemsElRef } = value
  return itemsElRef
}
function syncVLScroller(): void {
  scrollerInstRef.value?.sync()
}

onMounted(() => {
  if (props.scrollToEndDefault) {
    scrollerInstRef.value?.scrollTo({
      position: 'bottom',
      behavior: 'smooth',
    })
  }
})

const parentHeight = computed(() => {
  return scrollerInstRef.value?.$el.parentElement?.clientHeight ?? 0
})
const height = computed(() => {
  if (typeof props.defaultHeight === 'number') {
    return props.defaultHeight < 0 ? `${parentHeight.value}px` : `${props.defaultHeight}px`
  }
  const val = String(props.defaultHeight).trim()
  if (val.endsWith('px') || val.endsWith('vh') || val.endsWith('vw') || val.endsWith('rem') || val.endsWith('em')) {
    return val
  }
  if (val.endsWith('%')) {
    return `${parentHeight.value * (Number(val.replace('%', '')) / 100)}px`
  }
  const num = Number(val)
  if (!Number.isNaN(num)) {
    return num < 0 ? `${parentHeight.value}px` : `${num}px`
  }
  return '600px'
})
</script>

<template>
  <NScrollbar
    ref="scrollerInstRef"
    :style="`height:${height}`"
    :container="scrollContainer"
    :content="scrollContent"
    trigger="none"
  >
    <VVirtualList
      ref="vlInstRef"
      :items="items"
      :item-size="defaultSize"
      item-resizable
      key-field="id"
      :show-scrollbar="false"
      @scroll="syncVLScroller"
    >
      <template #default="{ item }">
        <slot :item="item" />
      </template>
    </VVirtualList>
  </NScrollbar>
</template>
