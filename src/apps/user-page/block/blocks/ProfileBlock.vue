<script setup lang="ts">
import { computed } from 'vue'

import type { ResponseUserInfo } from '@/api/generated/model'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{
  userInfo: ResponseUserInfo | undefined
  biliInfo: any | undefined
  blockProps: unknown
}>()

const model = computed(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as any)
      : {}

  const avatarFile =
    o.avatarFile && typeof o.avatarFile === 'object' && !Array.isArray(o.avatarFile) ? o.avatarFile : null
  const avatarUrl =
    avatarFile && typeof avatarFile.path === 'string' && avatarFile.path
      ? avatarFile.path
      : props.userInfo?.streamerInfo?.faceUrl
  const displayName = typeof o.displayName === 'string' && o.displayName ? o.displayName : props.userInfo?.name
  const bio = typeof o.bio === 'string' && o.bio ? o.bio : props.biliInfo?.sign

  const framed = typeof o.framed === 'boolean' ? o.framed : true
  const backgrounded = typeof o.backgrounded === 'boolean' ? o.backgrounded : true
  return { avatarUrl, displayName, bio, framed, backgrounded }
})
</script>

<template>
  <BlockCard
    :framed="model.framed"
    :backgrounded="model.backgrounded"
    :content-style="{ padding: 0 }"
  >
    <div class="flex flex-col items-center px-4 py-8 relative overflow-hidden text-center">
      <div class="relative mb-6">
        <Avatar
          v-if="model.avatarUrl"
          class="size-28 border-4 border-muted shadow-md relative z-2"
        >
          <AvatarImage
            :src="model.avatarUrl"
            :alt="model.displayName || '用户头像'"
            referrerpolicy="no-referrer"
            loading="lazy"
            decoding="async"
          />
          <AvatarFallback class="text-xl font-bold">
            {{ (model.displayName || 'U').slice(0, 1) }}
          </AvatarFallback>
        </Avatar>
      </div>

      <div>
        <h1
          v-if="model.displayName"
          class="text-[32px] font-extrabold leading-tight m-0 mb-3 text-foreground"
        >
          {{ model.displayName }}
        </h1>
        <p
          v-if="model.bio"
          class="text-[15px] leading-relaxed text-muted-foreground max-w-[500px] mx-auto m-0 whitespace-pre-wrap"
        >
          {{ model.bio }}
        </p>
      </div>
    </div>
  </BlockCard>
</template>
