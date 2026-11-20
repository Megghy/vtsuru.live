<script setup lang="ts">
import type { AvatarImageProps } from 'reka-ui'
import { AvatarImage } from 'reka-ui'
import type { ImgHTMLAttributes } from 'vue'
import { computed, ref } from 'vue'

import { useAutoImageSrc } from '@/shared/services/useAutoImageSrc'

interface Props extends AvatarImageProps {
  /** 兼容 HTML 原生小写属性写法 */
  referrerpolicy?: ImgHTMLAttributes['referrerpolicy']
  fileId?: number
  isPublic?: boolean
  disableTransform?: boolean
}

const props = defineProps<Props>()
const avatarRef = ref<unknown>(null)

const { src: autoSrc, handleError } = useAutoImageSrc(
  avatarRef,
  () => props.src,
  () => ({
    transform: props.disableTransform ? false : 'auto',
    fallbackTransform: 'avatar',
    crop: true,
    fileId: props.fileId,
    isPublic: props.isPublic,
  }),
)

const forwardedProps = computed<AvatarImageProps>(() => {
  const {
    referrerpolicy,
    referrerPolicy,
    fileId: _fileId,
    isPublic: _isPublic,
    disableTransform: _disable,
    src: _src,
    ...rest
  } = props
  return {
    ...rest,
    src: autoSrc.value,
    // B 站头像等外链图床依赖 no-referrer 避免 403
    referrerPolicy: referrerPolicy ?? referrerpolicy ?? 'no-referrer',
  }
})
</script>

<template>
  <AvatarImage
    ref="avatarRef"
    v-bind="forwardedProps"
    class="h-full w-full object-cover"
    @error="handleError"
  >
    <slot />
  </AvatarImage>
</template>
