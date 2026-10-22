<script setup lang="ts">
import { ArrowReply16Filled, Delete24Filled } from '@vicons/fluent'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import type { ForumCommentModel, ForumReplyModel, ForumTopicModel } from '@/api/models/forum'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { getUserAvatarUrl } from '@/shared/utils'
import { useForumStore } from '@/store/useForumStore'

const props = defineProps<{
  item: ForumReplyModel
  replyTo?: ForumReplyModel
  replyToId?: number
  comment: ForumCommentModel
  topic: ForumTopicModel
  showReplyButton?: boolean
}>()

const emits = defineEmits<{
  (e: 'delete', id: number): void
}>()
const useForum = useForumStore()
const accountInfo = useAccount()

const canOprate = computed(() => {
  return !props.topic.isLocked && accountInfo.value.id > 0
})

function formatRelativeTime(time: number) {
  try {
    return formatDistanceToNow(new Date(time), { addSuffix: true, locale: zhCN })
  } catch {
    return String(time)
  }
}

function formatFullTime(time: number) {
  try {
    return format(new Date(time), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return String(time)
  }
}
</script>

<template>
  <TooltipProvider>
    <div class="forum-reply-item flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs py-1">
      <div class="flex items-center gap-1.5 shrink-0">
        <Tooltip v-if="replyTo">
          <TooltipTrigger as-child>
            <span class="text-muted-foreground hover:text-foreground cursor-pointer">
              <component
                :is="ArrowReply16Filled"
                class="size-3.5"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent class="max-w-xs p-2 text-xs">
            <ForumReplyItem
              :item="replyTo"
              :comment="comment"
              :topic="topic"
              :show-reply-button="false"
            />
          </TooltipContent>
        </Tooltip>

        <Avatar class="size-6 rounded-full shrink-0">
          <AvatarImage
            :src="getUserAvatarUrl(item.user.id)"
            referrerpolicy="no-referrer"
          />
          <AvatarFallback class="text-[10px]">{{ item.user.name.charAt(0) }}</AvatarFallback>
        </Avatar>

        <strong class="text-muted-foreground font-semibold whitespace-nowrap text-xs">
          {{ item.user.name }}
        </strong>
      </div>

      <div class="text-foreground flex-1 min-w-0 break-words">
        {{ item.content }}
      </div>

      <div class="flex items-center justify-end gap-1.5 shrink-0 ml-auto">
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="text-[11px] text-muted-foreground min-w-12 text-right cursor-help">
              {{ formatRelativeTime(item.sendAt) }}
            </span>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            {{ formatFullTime(item.sendAt) }}
          </TooltipContent>
        </Tooltip>

        <Tooltip v-if="showReplyButton">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-6 rounded-full text-muted-foreground hover:text-foreground"
              :disabled="!canOprate"
              @click="useForum.SetReplyingComment(comment, item)"
            >
              <component
                :is="ArrowReply16Filled"
                class="size-3"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="text-xs">回复这条回复</TooltipContent>
        </Tooltip>

        <Popconfirm
          v-if="(item.user.id === accountInfo.id || topic.isAdmin) && showReplyButton"
          title="确定删除这条回复吗？"
          positive-text="确认删除"
          negative-text="取消"
          @positive-click="emits('delete', item.id)"
        >
          <template #trigger>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-6 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  :disabled="!canOprate"
                >
                  <component
                    :is="Delete24Filled"
                    class="size-3"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent class="text-xs">删除</TooltipContent>
            </Tooltip>
          </template>
          确定删除这条回复吗？
        </Popconfirm>
      </div>
    </div>
  </TooltipProvider>
</template>
