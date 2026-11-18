<script setup lang="ts">
import type { AvatarImageProps } from 'reka-ui'
import { AvatarImage } from 'reka-ui'
import type { ImgHTMLAttributes } from 'vue'
import { computed } from 'vue'

interface Props extends AvatarImageProps {
  /** 兼容 HTML 原生小写属性写法 */
  referrerpolicy?: ImgHTMLAttributes['referrerpolicy']
}

const props = defineProps<Props>()

const forwardedProps = computed<AvatarImageProps>(() => {
  const { referrerpolicy, referrerPolicy, ...rest } = props
  return {
    ...rest,
    // B 站头像等外链图床依赖 no-referrer 避免 403
    referrerPolicy: referrerPolicy ?? referrerpolicy ?? 'no-referrer',
  }
})
</script>

<template>
  <AvatarImage
    v-bind="forwardedProps"
    class="h-full w-full object-cover"
  >
    <slot />
  </AvatarImage>
</template>
