<script setup lang="ts">
import { computed } from 'vue'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'

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
  <Avatar
    class="shrink-0 border border-border/80"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <AvatarImage
      :src="src || DEFAULT_AVATAR"
      referrerpolicy="no-referrer"
      class="object-cover"
    />
    <AvatarFallback>
      <img
        :src="DEFAULT_AVATAR"
        class="object-cover size-full"
        alt=""
      />
    </AvatarFallback>
  </Avatar>
</template>
