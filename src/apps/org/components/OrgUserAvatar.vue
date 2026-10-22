<script setup lang="ts">
import { computed } from 'vue'

import { DEFAULT_AVATAR, withImageSize } from '../utils'

const props = withDefaults(
  defineProps<{
    faceUrl?: string | null
    size?: number
  }>(),
  { size: 40 },
)

const src = computed(() => withImageSize(props.faceUrl, `@${props.size}w`))
</script>

<template>
  <img
    :src="src || DEFAULT_AVATAR"
    referrerpolicy="no-referrer"
    class="rounded-full object-cover shrink-0 border border-border/80"
    :style="{ width: `${size}px`, height: `${size}px` }"
    alt=""
    @error="(e) => ((e.target as HTMLImageElement).src = DEFAULT_AVATAR)"
  />
</template>
