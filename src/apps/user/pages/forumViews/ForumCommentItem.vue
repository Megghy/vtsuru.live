<script setup lang="ts">
import { ArrowReply16Filled } from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import {
  NAvatar,
  NButton,
  NCard,
  NFlex,
  NIcon,
  NTag,
  NText,
  NTime,
  NTooltip,
  useThemeVars,
} from 'naive-ui'
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import type { ForumCommentModel, ForumTopicModel } from '@/api/models/forum'
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
const themeVars = useThemeVars()

const accentColor = computed(() => themeVars.value.errorColor)

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
</script>

<template>
  <NFlex>
    <NAvatar
      :src="getUserAvatarUrl(item.user.id)"
      :img-props="{ referrerpolicy: 'no-referrer' }"
    />
    <NFlex
      vertical
      style="flex: 1"
      :size="2"
    >
      <NFlex align="center">
        <NTag
          v-if="item.isDeleted"
          type="warning"
          :bordered="false"
        >
          已删除
        </NTag>
        <NText>
          {{ item.user.name }}
        </NText>
        <NText depth="3">
          <NTooltip>
            <template #trigger>
              <NTime
                :time="item.sendAt"
                type="relative"
              />
            </template>
            <NTime :time="item.sendAt" />
          </NTooltip>
        </NText>
      </NFlex>
      <div
        class="editor-content-view"
        v-html="item.content"
      />

      <NCard
        v-if="item.replies.length > 0"
        size="small"
        style="margin-bottom: 10px"
      >
        <NFlex vertical>
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
        </NFlex>
      </NCard>
      <NFlex>
        <NTooltip>
          <template #trigger>
            <NButton
              size="small"
              text
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
              <template #icon>
                <NIcon
                  :component="item.isLiked ? Heart : HeartOutline"
                  :color="item.isLiked ? accentColor : undefined"
                />
              </template>
              {{ item.likeCount }}
            </NButton>
          </template>
          点赞
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton
              size="small"
              text
              :disabled="!canOprate"
              @click="useForum.SetReplyingComment(item)"
            >
              <template #icon>
                <NIcon :component="ArrowReply16Filled" />
              </template>
              {{ item.replies.length }}
            </NButton>
          </template>
          回复
        </NTooltip>
        <NFlex
          style="flex: 1"
          justify="end"
        >
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
        </NFlex>
      </NFlex>
    </NFlex>
  </NFlex>
</template>
