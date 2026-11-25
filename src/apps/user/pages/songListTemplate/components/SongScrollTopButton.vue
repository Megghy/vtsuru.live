<script setup lang="ts">
import { ArrowUp } from 'lucide-vue-next'
import { computed } from 'vue'
import { useWindowScroll } from '@vueuse/core'

import { Button } from '@/shared/ui/button'

const props = withDefaults(
  defineProps<{
    threshold?: number
  }>(),
  {
    threshold: 420,
  },
)

const { y } = useWindowScroll()
const visible = computed(() => y.value > props.threshold)

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <Transition name="stage-meta">
    <Button
      v-if="visible"
      type="button"
      variant="secondary"
      size="icon-sm"
      class="fixed bottom-16 right-4 z-30 rounded-full shadow-md border border-border/80 bg-card/90 backdrop-blur-md"
      aria-label="返回顶部"
      @click="scrollToTop"
    >
      <ArrowUp class="size-4" />
    </Button>
  </Transition>
</template>
