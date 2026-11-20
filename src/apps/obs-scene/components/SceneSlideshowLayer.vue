<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { SlideshowLayer } from '../types'

const props = defineProps<{
  layer: SlideshowLayer
  mode: 'edit' | 'preview' | 'live'
}>()

const slideCfg = computed(() => props.layer.slideshow)
const validImages = computed(() => slideCfg.value.images.filter((img) => Boolean(img.url?.trim())))
const currentIndex = ref(0)

let timer: ReturnType<typeof setInterval> | null = null

function clearTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function startTimer() {
  clearTimer()
  if (validImages.value.length <= 1) return
  const ms = Math.max(1000, Math.round((slideCfg.value.intervalSec || 5) * 1000))
  timer = setInterval(() => {
    if (validImages.value.length <= 1) return
    currentIndex.value = (currentIndex.value + 1) % validImages.value.length
  }, ms)
}

watch(
  () => [validImages.value.length, slideCfg.value.intervalSec],
  () => {
    if (currentIndex.value >= validImages.value.length) {
      currentIndex.value = 0
    }
    startTimer()
  },
)

onMounted(startTimer)
onBeforeUnmount(clearTimer)

const activeImage = computed(() => validImages.value[currentIndex.value] ?? null)
const transitionName = computed(() => {
  if (slideCfg.value.transition === 'none') return 'slide-none'
  if (slideCfg.value.transition === 'slide') return 'slide-shift'
  return 'slide-fade'
})
</script>

<template>
  <div
    class="relative w-full h-full overflow-hidden select-none"
    :style="{ backgroundColor: slideCfg.backgroundColor || 'transparent' }"
  >
    <div
      v-if="!activeImage"
      class="w-full h-full flex-center bg-muted/40 border border-dashed border-border text-muted-foreground text-sm px-4 text-center"
    >
      图片轮播：请在右侧上传或添加多张宣传图
    </div>

    <template v-else>
      <Transition :name="transitionName" mode="out-in">
        <img
          :key="`${activeImage.id}-${currentIndex}`"
          :src="activeImage.url"
          :alt="activeImage.label || layer.name"
          draggable="false"
          class="w-full h-full block"
          :style="{ objectFit: slideCfg.objectFit || 'cover' }"
        />
      </Transition>

      <div
        v-if="slideCfg.showDots && validImages.length > 1"
        class="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-xs"
      >
        <span
          v-for="(img, idx) in validImages"
          :key="img.id"
          class="h-1.5 rounded-full transition-all duration-200"
          :class="idx === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/45'"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 280ms ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
}

.slide-shift-enter-active,
.slide-shift-leave-active {
  transition: opacity 240ms ease, transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}
.slide-shift-enter-from {
  opacity: 0;
  transform: translate3d(24px, 0, 0);
}
.slide-shift-leave-to {
  opacity: 0;
  transform: translate3d(-24px, 0, 0);
}
</style>
