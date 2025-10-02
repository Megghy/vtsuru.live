<script setup lang="ts">
import type { ForumCommentModel, ForumTopicModel } from '@/api/models/forum'
import { ArrowReply16Filled, Delete24Filled } from '@vicons/fluent'
import { Heart, HeartOutline, SyncCircleSharp } from '@vicons/ionicons5'
import { NAvatar, NButton, NCard, NFlex, NIcon, NPopconfirm, NTag, NText, NTime, NTooltip } from 'naive-ui'
import { computed } from 'vue'
import { useAccount } from '@/api/account'
import { VTSURU_API_URL } from '@/data/constants'
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
      props.item.replies = props.item.replies.filter(reply => reply.id !== id)
    }
  })
}
</script>

<template>
  <NFlex>
    <NAvatar
      :src="`${VTSURU_API_URL}user-face/${item.user.id}?size=64`"
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
                  :color="item.isLiked ? '#dd484f' : ''"
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
          <NTooltip v-if="item.user.id === accountInfo.id || topic.isAdmin">
            <template #trigger>
              <NPopconfirm @positive-click="delComment(item.id)">
                <template #trigger>
                  <NButton
                    size="small"
                    text
                    :disabled="!canOprate"
                  >
                    <template #icon>
                      <NIcon
                        :component="Delete24Filled"
                        :color="item.isDeleted || topic.isAdmin ? '#dd484f' : '#7f7f7f'"
                      />
                    </template>
                  </NButton>
                </template>
                {{ item.isDeleted ? '确定完全删除这条评论吗? 这将无法恢复' : '确定删除这条评论吗' }}
              </NPopconfirm>
            </template>
            {{ item.isDeleted || topic.isAdmin ? '完全' : '' }}删除
          </NTooltip>
          <NTooltip v-if="item.isDeleted && topic.isAdmin">
            <template #trigger>
              <NPopconfirm @positive-click="restoreComment(item.id)">
                <template #trigger>
                  <NButton
                    size="small"
                    text
                    :disabled="!canOprate"
                  >
                    <template #icon>
                      <NIcon
                        :component="SyncCircleSharp"
                        color="#7f7f7f"
                      />
                    </template>
                  </NButton>
                </template>
                要恢复这条评论吗?
              </NPopconfirm>
            </template>
            恢复
          </NTooltip>
        </NFlex>
      </NFlex>
    </NFlex>
  </NFlex>
</template>
