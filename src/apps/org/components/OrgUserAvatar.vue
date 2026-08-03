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
const avatarSrc = computed(() => src.value || DEFAULT_AVATAR)
</script>

<template>
  <UAvatar
    :src="avatarSrc"
    :alt="'组织成员头像'"
    :style="{ width: `${size}px`, height: `${size}px` }"
    class="org-avatar"
  />
</template>

<style scoped>
.org-avatar {
  flex: 0 0 auto;
  border: 1px solid var(--vtsuru-border);
}
</style>
