<script setup lang="ts">
import { ArrowReply16Filled } from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import type { ForumCommentModel, ForumTopicModel } from '@/api/models/forum'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { getUserAvatarUrl } from '@/shared/utils'
import { useForumStore } from '@/store/useForumStore'

import ForumActionBar from './ForumActionBar.vue'
import ForumReplyItem from './ForumReplyItem.vue'

const props = defineProps<{
  item: ForumCommentModel
  topic: ForumTopicModel
}>()

const emits = defineEmits<{
  (e: 'delete', id: number): void
}>()
const useForum = useForumStore()
const accountInfo = useAccount()

const canOprate = computed(() => {
  return !props.topic.isLocked && accountInfo.value.id > 0
})

function delComment(id: number) {
  useForum.DelComment(id).then((success) => {
    if (success) {
      emits('delete', id)
    }
  })
}
function restoreComment(id: number) {
  useForum.RestoreComment(id).then((success) => {
    if (success) {
      props.item.isDeleted = false
    }
  })
}
function delReply(id: number) {
  useForum.DelReply(id).then((success) => {
    if (success) {
      props.item.replies = props.item.replies.filter((reply) => reply.id !== id)
    }
  })
}

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
    <div class="flex items-start gap-3 py-3 border-b border-border/50 text-xs">
      <Avatar class="size-8 rounded-full shrink-0">
        <AvatarImage :src="getUserAvatarUrl(item.user.id)" referrerpolicy="no-referrer" />
        <AvatarFallback>{{ item.user.name.charAt(0) }}</AvatarFallback>
      </Avatar>

      <div class="flex-1 min-w-0 space-y-2">
        <div class="flex items-center gap-2">
          <Badge
            v-if="item.isDeleted"
            variant="destructive"
            class="text-[10px] h-4.5 px-1.5 font-normal"
          >
            已删除
          </Badge>
          <strong class="font-medium text-foreground">{{ item.user.name }}</strong>
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="text-[11px] text-muted-foreground cursor-help">
                {{ formatRelativeTime(item.sendAt) }}
              </span>
            </TooltipTrigger>
            <TooltipContent class="text-xs">
              {{ formatFullTime(item.sendAt) }}
            </TooltipContent>
          </Tooltip>
        </div>

        <div
          class="editor-content-view text-xs leading-relaxed text-foreground break-words"
          v-html="item.content"
        />

        <Card
          v-if="item.replies.length > 0"
          class="bg-muted/30 border-border/60 shadow-none my-2"
        >
          <CardContent class="p-2.5 space-y-1.5 divide-y divide-border/30">
            <ForumReplyItem
              v-for="reply in item.replies"
              :key="reply.id"
              :item="reply"
              :comment="item"
              :topic="topic"
              show-reply-button
              :reply-to="reply.replyTo ? item.replies.find((r) => r.id === reply.replyTo) : undefined"
              :reply-to-id="reply.replyTo"
              @delete="delReply"
            />
          </CardContent>
        </Card>

        <div class="flex items-center gap-3 pt-1">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 text-xs flex items-center gap-1 px-2 text-muted-foreground hover:text-foreground"
                :class="{ 'text-destructive': item.isLiked }"
                :disabled="!canOprate || useForum.isLikeLoading"
                @click="
                  useForum.LikeComment(item.id, !item.isLiked).then((success) => {
                    if (success) {
                      item.isLiked = !item.isLiked
                      item.likeCount += item.isLiked ? 1 : -1
                    }
                  })
                "
              >
                <component :is="item.isLiked ? Heart : HeartOutline" class="size-3.5" />
                <span>{{ item.likeCount }}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent class="text-xs">点赞</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 text-xs flex items-center gap-1 px-2 text-muted-foreground hover:text-foreground"
                :disabled="!canOprate"
                @click="useForum.SetReplyingComment(item)"
              >
                <component :is="ArrowReply16Filled" class="size-3.5" />
                <span>{{ item.replies.length }}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent class="text-xs">回复</TooltipContent>
          </Tooltip>

          <div class="ml-auto">
            <ForumActionBar
              :can-operate="canOprate"
              :can-manage="item.user.id === accountInfo.id || topic.isAdmin"
              :is-deleted="item.isDeleted"
              :is-admin="topic.isAdmin"
              delete-confirm="确定删除这条评论吗"
              hard-delete-confirm="确定完全删除这条评论吗? 这将无法恢复"
              restore-confirm="要恢复这条评论吗?"
              @delete="delComment(item.id)"
              @restore="restoreComment(item.id)"
            />
          </div>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>
