<script setup lang="ts" generic="T extends { id: string | number }">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    items: T[]
    defaultHeight: number | string
    scrollToEndDefault?: boolean
  }>(),
  { scrollToEndDefault: false },
)

const scroller = ref<HTMLElement>()
const height = computed(() =>
  typeof props.defaultHeight === 'number' ? `${props.defaultHeight}px` : props.defaultHeight,
)

async function scrollToEnd() {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
}

onMounted(() => props.scrollToEndDefault && scrollToEnd())
watch(
  () => props.items.length,
  () => props.scrollToEndDefault && scrollToEnd(),
)
</script>

<template>
  <div
    ref="scroller"
    class="simple-list"
    :style="{ height }"
  >
    <div
      v-for="item in items"
      :key="item.id"
    >
      <slot :item="item" />
    </div>
  </div>
</template>

<style scoped>
.simple-list {
  overflow: auto;
  overscroll-behavior: contain;
}
</style>
