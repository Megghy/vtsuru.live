<script setup lang="ts">
import { ArrowReply24Filled, Chat24Regular, Delete24Filled, MoreVertical24Filled, Star24Filled } from '@vicons/fluent'
import { SyncCircleSharp } from '@vicons/ionicons5'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import { useAccount } from '@/api/account'
import type { ResponseForumTopicSimpleModel } from '@/api/generated/model'
import type { ResponseForumBaseModel } from '@/api/generated/model/responseForumBaseModel'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { toast } from '@/shared/utils'
import { useForumStore } from '@/store/useForumStore'

const props = defineProps<{
  item: ResponseForumTopicSimpleModel
  forum: ResponseForumBaseModel
}>()

const useForum = useForumStore()
const accountInfo = useAccount()

function handleDropdownAction(key: string) {
  switch (key) {
    case 'delete':
      if (confirm('确定要删除这条话题吗？')) {
        useForum.DelTopic(props.item.id).then((success) => {
          if (success) {
            toast.success('话题已删除')
            setTimeout(() => {
              window.location.reload()
            }, 1000)
          }
        })
      }
      break
    case 'restore':
      if (confirm('确定要恢复这条话题吗？')) {
        useForum.RestoreTopic(props.item.id).then((success) => {
          if (success) {
            props.item.isDeleted = false
            toast.success('话题已恢复')
          }
        })
      }
      break
    case 'top':
      if (confirm(`确定要${props.item.isPinned ? '取消' : ''}置顶这条话题吗？`)) {
        useForum.SetTopicTop(props.item.id, !props.item.isPinned).then((success) => {
          if (success) {
            props.item.isPinned = !props.item.isPinned
            toast.success(props.item.isPinned ? '已置顶' : '已取消置顶')
          }
        })
      }
      break
  }
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
    <div class="flex items-center justify-between gap-3 text-xs w-full py-1">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <Badge
          v-if="item.isDeleted"
          variant="secondary"
          class="text-[10px] h-4.5 px-1.5 font-normal shrink-0"
        >
          已删除
        </Badge>
        <span
          v-if="item.isPinned"
          class="size-4 text-amber-500 inline-flex items-center justify-center shrink-0"
          title="置顶"
        >
          <component
            :is="Star24Filled"
            class="size-3.5"
          />
        </span>
        <Badge
          variant="outline"
          class="text-[10px] h-4.5 px-1.5 font-normal flex items-center gap-1 shrink-0"
        >
          <component
            :is="Chat24Regular"
            class="size-3"
          />
          <span>{{ item.commentCount }}</span>
        </Badge>
        <span
          class="text-sm font-medium truncate"
          :class="[
            item.user?.id === accountInfo?.id ? 'text-primary' : 'text-foreground',
            item.isDeleted ? 'opacity-50 line-through' : '',
          ]"
        >
          {{ item.title }}
        </span>
      </div>

      <div class="flex items-center gap-2 text-muted-foreground shrink-0 text-xs">
        <template v-if="item.latestRepliedBy">
          <span class="inline-flex items-center gap-1">
            <component
              :is="ArrowReply24Filled"
              class="size-3"
            />
            @{{ item.latestRepliedBy.name }}
          </span>
        </template>
        <template v-else>
          <span>@{{ item.user?.name }} 发布于</span>
        </template>

        <Tooltip>
          <TooltipTrigger as-child>
            <span class="cursor-help hover:text-foreground text-[11px]">
              {{ formatRelativeTime(item.createAt) }}
            </span>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            {{ formatFullTime(item.createAt) }}
          </TooltipContent>
        </Tooltip>

        <DropdownMenu v-if="forum.isAdmin">
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-6 rounded-full text-muted-foreground hover:text-foreground"
            >
              <component
                :is="MoreVertical24Filled"
                class="size-3.5"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            class="text-xs"
          >
            <DropdownMenuItem @select="handleDropdownAction('top')">
              <component
                :is="Star24Filled"
                class="size-3.5 mr-1.5 text-amber-500"
              />
              <span>{{ item.isPinned ? '取消置顶' : '置顶' }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              class="text-destructive"
              @select="handleDropdownAction(item.isDeleted ? 'restore' : 'delete')"
            >
              <component
                :is="item.isDeleted ? SyncCircleSharp : Delete24Filled"
                class="size-3.5 mr-1.5"
              />
              <span>{{ item.isDeleted ? '恢复' : '删除' }}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </TooltipProvider>
</template>
