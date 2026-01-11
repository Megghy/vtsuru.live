<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { NAvatar, NFlex, NText } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  blockProps: unknown
}>()

const model = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}

  const avatarFile = (o.avatarFile && typeof o.avatarFile === 'object' && !Array.isArray(o.avatarFile)) ? o.avatarFile : null
  const avatarUrl = (avatarFile && typeof avatarFile.path === 'string' && avatarFile.path)
    ? avatarFile.path
    : ((typeof o.avatarUrl === 'string' && o.avatarUrl) ? o.avatarUrl : props.userInfo?.streamerInfo?.faceUrl)
  const displayName = (typeof o.displayName === 'string' && o.displayName) ? o.displayName : props.userInfo?.name
  const bio = (typeof o.bio === 'string' && o.bio) ? o.bio : props.biliInfo?.sign

  return { avatarUrl, displayName, bio }
})
</script>

<template>
  <NFlex
    vertical
    align="center"
    style="padding: 12px 0"
  >
    <NAvatar
      v-if="model.avatarUrl"
      :src="model.avatarUrl"
      :img-props="{ referrerpolicy: 'no-referrer' }"
      round
      :size="100"
    />
    <NText
      v-if="model.displayName"
      strong
      style="font-size: 22px; margin-top: 10px"
    >
      {{ model.displayName }}
    </NText>
    <NText
      v-if="model.bio"
      depth="2"
      style="white-space: pre-wrap; margin-top: 6px; text-align: center"
    >
      {{ model.bio }}
    </NText>
  </NFlex>
</template>
