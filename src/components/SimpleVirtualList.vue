<script setup lang="ts">
import type { ScrollbarInst } from 'naive-ui/es/_internal'
import { NScrollbar } from 'naive-ui/es/_internal'
import { computed, onMounted, ref, type PropType } from 'vue'
import type { VirtualListInst } from 'vueuc'
import { VVirtualList } from 'vueuc'
import type { ItemData } from 'vueuc/lib/virtual-list/src/type'

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
function ScrollTo(to: { position: 'top' | 'bottom'; behavior?: ScrollBehavior; debounce?: boolean }) {
  scrollerInstRef.value?.scrollTo(to)
}

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
  if (typeof props.defaultHeight == 'number') return (props.defaultHeight < 0 ? parentHeight : props.defaultHeight) + 'px'
  else {
    if (props.defaultHeight.endsWith('%')) {
      return parentHeight.value * (Number(props.defaultHeight.replace('%', '')) / 100) + 'px'
    } else if (props.defaultHeight.endsWith('vh') || props.defaultHeight.endsWith('vw')) {
      return props.defaultHeight
    } else {
      console.log(`[SimpleVirtualList] Invalid height value: ${props.defaultHeight}`)
      return 0 + 'px'
    }
  }
})
</script>

<template>
  <NScrollbar ref="scrollerInstRef" :style="'height:' + height" :container="scrollContainer" :content="scrollContent" trigger="none">
    <VVirtualList ref="vlInstRef" :items="items" :item-size="defaultSize" item-resizable key-field="id" :show-scrollbar="false" @scroll="syncVLScroller">
      <template #default="{ item }">
        <slot :item="item"> </slot>
      </template>
    </VVirtualList>
  </NScrollbar>
</template>
