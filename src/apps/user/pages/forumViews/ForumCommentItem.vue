<script setup lang="ts">
import { ArrowReply16Filled, Delete24Filled } from '@vicons/fluent'
import { Heart, HeartOutline, SyncCircleSharp } from '@vicons/ionicons5'
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import type { ForumCommentModel, ForumTopicModel } from '@/api/models/forum'
import PublicTime from '@/apps/user-page/PublicTime.vue'
import { VTSURU_API_URL } from '@/shared/config'
import { useForumStore } from '@/store/useForumStore'

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
const accentColor = 'var(--ui-error)'
const mutedIconColor = 'var(--vtsuru-surface-fg-subtle)'

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

function confirmDeleteComment() {
  const content =
    props.item.isDeleted || props.topic.isAdmin ? '确定完全删除这条评论吗？这将无法恢复。' : '确定删除这条评论吗？'
  if (window.confirm(content)) delComment(props.item.id)
}

function confirmRestoreComment() {
  if (window.confirm('要恢复这条评论吗？')) restoreComment(props.item.id)
}
function delReply(id: number) {
  useForum.DelReply(id).then((success) => {
    if (success) {
      props.item.replies = props.item.replies.filter((reply) => reply.id !== id)
    }
  })
}
</script>

<template>
  <div>
    <UAvatar
      :src="`${VTSURU_API_URL}user-face/${item.user.id}?size=64`"
      :img-props="{ referrerpolicy: 'no-referrer' }"
    />
    <div
      vertical
      style="flex: 1"
      :size="2"
    >
      <div align="center">
        <UBadge
          v-if="item.isDeleted"
          color="warning"
          :bordered="false"
        >
          已删除
        </UBadge>
        <span>
          {{ item.user.name }}
        </span>
        <span depth="3">
          <UTooltip>
            <PublicTime
              :time="item.sendAt"
              type="relative"
            />

            <template #content><PublicTime :time="item.sendAt" /></template>
          </UTooltip>
        </span>
      </div>
      <div
        class="editor-content-view"
        v-html="item.content"
      />

      <UCard
        v-if="item.replies.length > 0"
        class="user-page-card"
        size="small"
        style="margin-bottom: 10px"
      >
        <div vertical>
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
        </div>
      </UCard>
      <div>
        <UTooltip>
          <UButton
            size="sm"
            variant="link"
            :loading="useForum.isLikeLoading"
            :disabled="!canOprate"
            @click="
              useForum.LikeComment(item.id, !item.isLiked).then((success) => {
                if (success) {
                  item.isLiked = !item.isLiked
                  item.likeCount += item.isLiked ? 1 : -1
                }
              })
            "
          >
            <template #leading>
              <component
                :is="item.isLiked ? Heart : HeartOutline"
                :color="item.isLiked ? accentColor : undefined"
              />
            </template>
            {{ item.likeCount }}
          </UButton>
          <template #content> 点赞 </template></UTooltip
        >
        <UTooltip>
          <UButton
            size="sm"
            variant="link"
            :disabled="!canOprate"
            @click="useForum.SetReplyingComment(item)"
          >
            <template #leading>
              <component :is="ArrowReply16Filled" />
            </template>
            {{ item.replies.length }}
          </UButton>
          <template #content> 回复 </template></UTooltip
        >
        <div
          style="flex: 1"
          justify="end"
        >
          <UTooltip v-if="item.user.id === accountInfo.id || topic.isAdmin">
            <UButton
              size="sm"
              variant="link"
              :disabled="!canOprate"
              @click="confirmDeleteComment"
            >
              <template #leading>
                <component
                  :is="Delete24Filled"
                  :color="item.isDeleted || topic.isAdmin ? accentColor : mutedIconColor"
                />
              </template>
            </UButton>

            <template #content>{{ item.isDeleted || topic.isAdmin ? '完全' : '' }}删除 </template></UTooltip
          >
          <UTooltip v-if="item.isDeleted && topic.isAdmin">
            <UButton
              size="sm"
              variant="link"
              :disabled="!canOprate"
              @click="confirmRestoreComment"
            >
              <template #leading>
                <component
                  :is="SyncCircleSharp"
                  :color="mutedIconColor"
                />
              </template>
            </UButton>
            <template #content> 恢复 </template></UTooltip
          >
        </div>
      </div>
    </div>
  </div>
</template>
