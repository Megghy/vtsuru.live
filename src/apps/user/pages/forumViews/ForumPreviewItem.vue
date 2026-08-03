<script setup lang="ts">
import { ArrowReply24Filled, Chat24Regular, MoreVertical24Filled } from '@vicons/fluent'

import { useAccount } from '@/api/account'
import type { ForumModel, ForumTopicBaseModel } from '@/api/models/forum'
import PublicTime from '@/apps/user-page/PublicTime.vue'
import { useForumStore } from '@/store/useForumStore'

const props = defineProps<{
  item: ForumTopicBaseModel
  forum: ForumModel
}>()

const useForum = useForumStore()
const accountInfo = useAccount()

async function onDropdownSelect(key: string) {
  switch (key) {
    case 'delete':
      if (!window.confirm('确定要删除这条话题吗？')) return
      if (await useForum.DelTopic(props.item.id)) window.location.reload()
      break
    case 'restore':
      if (!window.confirm('确定要恢复这条话题吗？')) return
      if (await useForum.RestoreTopic(props.item.id)) props.item.isDeleted = false
      break
    case 'top':
      if (!window.confirm(`确定要${props.item.isPinned ? '取消' : ''}置顶这条话题吗？`)) return
      if (await useForum.SetTopicTop(props.item.id, !props.item.isPinned)) props.item.isPinned = !props.item.isPinned
      break
  }
}
</script>

<template>
  <div align="center">
    <div
      align="center"
      :wrap="false"
    >
      <UBadge
        v-if="item.isDeleted"
        size="sm"
        :bordered="false"
      >
        已删除
      </UBadge>
      <UBadge
        v-if="item.isPinned"
        size="sm"
        :bordered="false"
      >
        <UIcon name="i-lucide-pin" />
      </UBadge>
      <UBadge size="sm">
        <template #leading>
          <component :is="Chat24Regular" />
        </template>
        {{ item.commentCount }}
      </UBadge>
      <span
        :style="{ fontSize: 'large', color: item.user?.id === accountInfo?.id ? 'var(--ui-success)' : undefined }"
        :depth="item.isDeleted ? 3 : 1"
      >
        {{ item.title }}
      </span>
    </div>
    <div
      :style="{ flex: 1, color: 'var(--vtsuru-surface-fg-subtle)', fontSize: 'small' }"
      justify="end"
      align="center"
    >
      <template v-if="item.latestRepliedBy">
        <span>
          <component
            :is="ArrowReply24Filled"
            size="15"
          />
          @{{ item.latestRepliedBy.name }}
        </span>
      </template>
      <template v-else> @{{ item.user?.name }} 发布于 </template>
      <UTooltip>
        <PublicTime
          :time="item.createAt"
          type="relative"
        />

        <template #content><PublicTime :time="item.createAt" /></template>
      </UTooltip>
      <UDropdownMenu
        v-if="forum.isAdmin"
        :items="[
          {
            label: item.isPinned ? '取消置顶' : '置顶',
            icon: 'i-lucide-pin',
            onSelect: () => onDropdownSelect('top'),
          },
          {
            label: item.isDeleted ? '恢复' : '删除',
            icon: item.isDeleted ? 'i-lucide-rotate-ccw' : 'i-lucide-trash-2',
            color: 'error',
            onSelect: () => onDropdownSelect(item.isDeleted ? 'restore' : 'delete'),
          },
        ]"
      >
        <UButton variant="link">
          <template #leading>
            <component :is="MoreVertical24Filled" />
          </template>
        </UButton>
      </UDropdownMenu>
    </div>
  </div>
</template>
