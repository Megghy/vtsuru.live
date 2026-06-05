<script setup lang="ts">
import { NAvatar } from 'naive-ui'
import { computed } from 'vue'
import { DEFAULT_AVATAR, withImageSize } from '../utils'

const props = withDefaults(defineProps<{
  faceUrl?: string | null
  size?: number
}>(), { size: 40 })

const src = computed(() => withImageSize(props.faceUrl, `@${props.size}w`))
</script>

<template>
  <NAvatar
    round
    :size="size"
    :src="src"
    :img-props="{ referrerpolicy: 'no-referrer' }"
    :fallback-src="DEFAULT_AVATAR"
    style="border: 1px solid var(--n-divider-color); flex: 0 0 auto;"
  />
</template>
