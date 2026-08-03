<script setup lang="ts">
import { ArrowReply16Filled, Delete24Filled } from '@vicons/fluent'
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import type { ForumCommentModel, ForumReplyModel, ForumTopicModel } from '@/api/models/forum'
import PublicTime from '@/apps/user-page/PublicTime.vue'
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

function confirmDelete() {
  if (window.confirm('确定删除这条回复吗？')) emits('delete', props.item.id)
}
</script>

<template>
  <div
    align="center"
    class="forum-reply-item"
  >
    <div
      :wrap="false"
      align="center"
    >
      <UTooltip v-if="replyTo">
        <component :is="ArrowReply16Filled" />

        <template #content
          ><ForumReplyItem
            :item="replyTo"
            :comment="comment"
            :topic="topic"
            :show-reply-button="false"
        /></template>
      </UTooltip>
      <UAvatar
        :src="getUserAvatarUrl(item.user.id)"
        :img-props="{ referrerpolicy: 'no-referrer' }"
        size="sm"
        style="margin-top: -3px; min-width: 28px; min-height: 28px"
      />
      <span
        strong
        depth="3"
        style="white-space: nowrap"
      >
        {{ item.user.name }}
      </span>
    </div>
    {{ item.content }}
    <div
      justify="end"
      align="center"
      :wrap="false"
      style="flex: 1"
    >
      <UTooltip>
        <span
          depth="3"
          style="font-size: small; min-width: 50px"
        >
          <PublicTime
            :time="item.sendAt"
            type="relative"
          />
        </span>

        <template #content><PublicTime :time="item.sendAt" /></template>
      </UTooltip>
      <UTooltip v-if="showReplyButton">
        <UButton
          size="xs"
          square
          variant="soft"
          :disabled="!canOprate"
          @click="useForum.SetReplyingComment(comment, item)"
        >
          <template #leading>
            <component :is="ArrowReply16Filled" />
          </template>
        </UButton>
        <template #content> 回复这条回复 </template></UTooltip
      >
      <UTooltip
        v-if="(item.user.id === accountInfo.id || topic.isAdmin) && showReplyButton"
        text="删除"
      >
        <UButton
          size="xs"
          square
          color="neutral"
          variant="soft"
          :disabled="!canOprate"
          @click="confirmDelete"
        >
          <template #leading><component :is="Delete24Filled" /></template>
        </UButton>
      </UTooltip>
    </div>
  </div>
</template>

<style scoped>
@media screen and (min-width: 900px) {
  .forum-reply-item {
    flex-wrap: nowrap !important;
  }
}
</style>
