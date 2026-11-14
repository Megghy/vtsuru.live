<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import type { ResponseQAInfo, ResponseUserInfo } from '@/api/generated/model'
import { AVATAR_URL } from '@/shared/config'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { ImagePreview } from '@/shared/ui/image-preview'

defineProps<{
  item: ResponseQAInfo
  userInfo?: ResponseUserInfo
  label?: string
}>()

function formatRelativeTime(val: number) {
  return formatDistanceToNow(new Date(val > 1e11 ? val : val * 1000), { addSuffix: true, locale: zhCN })
}
</script>

<template>
  <div class="min-w-0">
    <div class="flex items-center gap-2 text-xs text-muted-foreground/70">
      <span
        v-if="label"
        class="px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary"
        >{{ label }}</span
      >
      <span
        class="max-w-[260px] truncate px-2 py-0.5 rounded-full border border-border bg-secondary/50 text-muted-foreground"
        >{{ formatRelativeTime(item.sendAt) }}</span
      >
      <span
        v-if="item.tag && !label"
        class="max-w-[260px] truncate px-2 py-0.5 rounded-full border border-border bg-secondary/50 text-muted-foreground"
        >{{ item.tag }}</span
      >
    </div>
    <p class="m-0 mt-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
      {{ item.question.message }}
    </p>
    <div
      v-if="item.questionImages?.length"
      class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 mt-2.5 @[max-width:480px]:grid-cols-2"
    >
      <ImagePreview
        v-for="(image, imgIdx) in item.questionImages"
        :key="image.path || imgIdx"
        :src="image.path || ''"
        :alt="image.name || '提问附图'"
        :gallery="item.questionImages"
        :index="imgIdx"
        class="w-full aspect-[4/3] h-auto"
      />
    </div>

    <div
      v-if="item.answer"
      class="relative mt-4 p-3.5 bg-secondary/40 border-l-3 border-primary rounded-md @[max-width:480px]:p-3"
    >
      <div class="flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground @[max-width:480px]:flex-wrap">
        <Avatar class="size-7">
          <AvatarImage
            :src="
              userInfo?.faceUrl ||
              userInfo?.streamerInfo?.faceUrl ||
              (userInfo?.biliId ? `${AVATAR_URL + userInfo.biliId}?size=64` : undefined)
            "
            referrerpolicy="no-referrer"
            :alt="`${userInfo?.name || '主播'} 的头像`"
          />
          <AvatarFallback>{{ (userInfo?.name || '主')[0] }}</AvatarFallback>
        </Avatar>
        <strong class="truncate font-semibold text-primary">{{ userInfo?.name || '主播' }}</strong>
        <span>的回复</span>
        <span
          v-if="item.answer.createdAt"
          class="text-xs text-muted-foreground/70 ml-auto @[max-width:480px]:w-full @[max-width:480px]:ml-8"
        >
          {{ formatRelativeTime(item.answer.createdAt) }}
        </span>
      </div>
      <p class="m-0 mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
        {{ item.answer.message }}
      </p>
      <div
        v-if="item.answerImages?.length"
        class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 mt-2.5 @[max-width:480px]:grid-cols-2"
      >
        <ImagePreview
          v-for="(image, imgIdx) in item.answerImages"
          :key="image.path || imgIdx"
          :src="image.path || ''"
          alt="回复附图"
          :gallery="item.answerImages"
          :index="imgIdx"
          class="w-full aspect-[4/3] h-auto"
        />
      </div>
    </div>
  </div>
</template>
