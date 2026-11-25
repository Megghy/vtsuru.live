<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Heart, Pin } from 'lucide-vue-next'
import { ref, watch } from 'vue'

import type { ResponseQAInfo, ResponseUserInfo } from '@/api/generated/model'
import { postApiQaLike } from '@/api/generated/qa/qa'
import { AVATAR_URL } from '@/shared/config'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ImagePreview } from '@/shared/ui/image-preview'
import { useMessage } from '@/shared/utils'

const props = defineProps<{
  item: ResponseQAInfo
  userInfo?: ResponseUserInfo
  label?: string
}>()

const message = useMessage()
const liked = ref(Boolean(props.item.isLiked))
const likeCount = ref(props.item.likeCount ?? 0)
const isLiking = ref(false)

watch(
  () => [props.item.id, props.item.isLiked, props.item.likeCount],
  () => {
    liked.value = Boolean(props.item.isLiked)
    likeCount.value = props.item.likeCount ?? 0
  },
)

function formatRelativeTime(val: number) {
  return formatDistanceToNow(new Date(val > 1e11 ? val : val * 1000), { addSuffix: true, locale: zhCN })
}

async function toggleLike() {
  if (isLiking.value) return
  const prevLiked = liked.value
  const prevCount = likeCount.value
  liked.value = !prevLiked
  likeCount.value = Math.max(0, prevCount + (liked.value ? 1 : -1))
  isLiking.value = true
  try {
    const resp = await postApiQaLike({ id: props.item.id })
    if (resp.code === 200 && resp.data) {
      liked.value = resp.data.liked
      likeCount.value = resp.data.likeCount
    } else {
      liked.value = prevLiked
      likeCount.value = prevCount
      message.error(resp.message || '点赞失败')
    }
  } catch {
    liked.value = prevLiked
    likeCount.value = prevCount
    message.error('网络异常，点赞失败')
  } finally {
    isLiking.value = false
  }
}
</script>

<template>
  <div class="min-w-0">
    <div class="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground/80">
      <Badge
        v-if="item.isPinned && !label"
        variant="secondary"
        size="xs"
        class="gap-1 bg-primary/12 text-primary border-primary/25"
      >
        <Pin class="size-3" />
        置顶
      </Badge>
      <Badge
        v-if="label"
        variant="outline"
        size="xs"
        class="border-primary/30 bg-primary/10 text-primary"
      >
        {{ label }}
      </Badge>
      <Badge
        variant="secondary"
        size="xs"
        class="max-w-[220px] truncate font-normal"
      >
        {{ formatRelativeTime(item.sendAt) }}
      </Badge>
      <Badge
        v-if="item.tag && !label"
        variant="outline"
        size="xs"
        class="max-w-[220px] truncate font-normal"
      >
        #{{ item.tag }}
      </Badge>

      <Button
        v-if="!label"
        variant="ghost"
        size="xs"
        class="ml-auto gap-1 text-muted-foreground hover:text-rose-500 tabular-nums"
        :class="{ 'text-rose-500': liked }"
        :disabled="isLiking"
        :aria-pressed="liked"
        aria-label="共鸣点赞"
        @click="toggleLike"
      >
        <Heart
          class="size-3.5"
          :class="{ 'fill-current': liked }"
        />
        <span>{{ likeCount > 0 ? likeCount : '同问' }}</span>
      </Button>
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
          v-if="item.isEdited"
          class="text-[11px] text-muted-foreground/70"
        >
          (已编辑)
        </span>
        <span
          v-if="item.answer.createdAt"
          class="text-xs text-muted-foreground/70 ml-auto tabular-nums @[max-width:480px]:w-full @[max-width:480px]:ml-8"
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
