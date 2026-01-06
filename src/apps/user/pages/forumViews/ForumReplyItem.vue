<script setup lang="ts">
import type { ForumCommentModel, ForumReplyModel, ForumTopicModel } from '@/api/models/forum'
import { ArrowReply16Filled, Delete24Filled } from '@vicons/fluent'
import { NAvatar, NButton, NFlex, NIcon, NPopconfirm, NText, NTime, NTooltip } from 'naive-ui'
import { computed } from 'vue'
import { useAccount } from '@/api/account'
import { useForumStore } from '@/store/useForumStore'
import { getUserAvatarUrl } from '@/shared/utils'

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
</script>

<template>
  <NFlex
    align="center"
    class="forum-reply-item"
  >
    <NFlex
      :wrap="false"
      align="center"
    >
      <NTooltip v-if="replyTo">
        <template #trigger>
          <NIcon :component="ArrowReply16Filled" />
        </template>
        <ForumReplyItem
          :item="replyTo"
          :comment="comment"
          :topic="topic"
          :show-reply-button="false"
        />
      </NTooltip>
      <NAvatar
        :src="getUserAvatarUrl(item.user.id)"
        :img-props="{ referrerpolicy: 'no-referrer' }"
        size="small"
        round
        style="margin-top: -3px; min-width: 28px; min-height: 28px"
      />
      <NText
        strong
        depth="3"
        style="white-space: nowrap"
      >
        {{ item.user.name }}
      </NText>
    </NFlex>
    {{ item.content }}
    <NFlex
      justify="end"
      align="center"
      :wrap="false"
      style="flex: 1"
    >
      <NTooltip>
        <template #trigger>
          <NText
            depth="3"
            style="font-size: small; min-width: 50px"
          >
            <NTime
              :time="item.sendAt"
              type="relative"
            />
          </NText>
        </template>
        <NTime :time="item.sendAt" />
      </NTooltip>
      <NTooltip v-if="showReplyButton">
        <template #trigger>
          <NButton
            size="tiny"
            round
            secondary
            :disabled="!canOprate"
            @click="useForum.SetReplyingComment(comment, item)"
          >
            <template #icon>
              <NIcon :component="ArrowReply16Filled" />
            </template>
          </NButton>
        </template>
        回复这条回复
      </NTooltip>
      <NPopconfirm
        v-if="(item.user.id === accountInfo.id || topic.isAdmin) && showReplyButton"
        @positive-click="emits('delete', item.id)"
      >
        <template #trigger>
          <NTooltip v-if="showReplyButton">
            <template #trigger>
              <NButton
                size="tiny"
                round
                secondary
                :disabled="!canOprate"
              >
                <template #icon>
                  <NIcon :component="Delete24Filled" />
                </template>
              </NButton>
            </template>
            删除
          </NTooltip>
        </template>
        确定删除这条回复吗
      </NPopconfirm>
    </NFlex>
  </NFlex>
</template>

<style scoped>
@media screen and (min-width: 900px) {
  .forum-reply-item {
    flex-wrap: nowrap !important;
  }
}
</style>
