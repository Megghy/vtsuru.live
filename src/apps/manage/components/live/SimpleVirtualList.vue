<script setup lang="ts">
import { useVirtualList } from '@vueuse/core'
import type { PropType } from 'vue'
import { computed, ref, toRef } from 'vue'

const props = defineProps({
  items: {
    type: Array as PropType<any[]>,
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

const containerRef = ref<HTMLElement | null>(null)
const itemsRef = toRef(props, 'items')

const parentHeight = computed(() => {
  return containerRef.value?.parentElement?.clientHeight ?? 0
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

const { list, containerProps, wrapperProps } = useVirtualList(itemsRef, {
  itemHeight: props.defaultSize,
})
</script>

<template>
  <div
    ref="containerRef"
    class="simple-virtual-list-wrapper"
    :style="`height:${height}; width: 100%;`"
  >
    <div
      v-bind="containerProps"
      style="height: 100%; width: 100%; overflow-y: auto"
    >
      <div v-bind="wrapperProps">
        <template
          v-for="item in list"
          :key="item.data?.id ?? item.index"
        >
          <slot :item="item.data" />
        </template>
      </div>
    </div>
  </div>
</template>
