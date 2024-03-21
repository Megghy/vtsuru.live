<script setup lang="ts">
import { useAccount } from '@/api/account'
import { ForumCommentModel, ForumTopicModel } from '@/api/models/forum'
import { VTSURU_API_URL } from '@/data/constants'
import { useForumStore } from '@/store/useForumStore'
import { ArrowReply16Filled } from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import { NAvatar, NButton, NCard, NDivider, NFlex, NIcon, NText, NTime, NTooltip } from 'naive-ui'
import ForumReplyItem from './ForumReplyItem.vue'
import { computed } from 'vue'

const props = defineProps<{
  item: ForumCommentModel
  topic: ForumTopicModel
}>()

const useForum = useForumStore()
const accountInfo = useAccount()

const canOprate = computed(() => {
  return !props.topic.isLocked && accountInfo.value.id > 0
})
</script>

<template>
  <NFlex>
    <NAvatar
      :src="VTSURU_API_URL + 'user-face/' + item.user.id + '?size=64'"
      :img-props="{ referrerpolicy: 'no-referrer' }"
    />
    <NFlex vertical style="flex: 1" :size="2">
      <NFlex>
        <NText>
          {{ item.user.name }}
        </NText>
        <NText depth="3">
          <NTooltip>
            <template #trigger>
              <NTime :time="item.sendAt" type="relative" />
            </template>
            <NTime :time="item.sendAt" />
          </NTooltip>
        </NText>
      </NFlex>
      <div class="editor-content-view" v-html="item.content"></div>
      <NDivider style="margin: 0" />
      <NFlex>
        <NTooltip>
          <template #trigger>
            <NButton
              size="small"
              @click="
                useForum.LikeComment(item.id, !item.isLiked).then((success) => {
                  if (success) {
                    item.isLiked = !item.isLiked
                    item.likeCount += item.isLiked ? 1 : -1
                  }
                })
              "
              text
              :loading="useForum.isLikeLoading"
              :disabled="!canOprate"
            >
              <template #icon>
                <NIcon :component="item.isLiked ? Heart : HeartOutline" :color="item.isLiked ? '#dd484f' : ''" />
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
              @click="useForum.SetReplyingComment(item)"
              text
              :disabled="!canOprate"
            >
              <template #icon>
                <NIcon :component="ArrowReply16Filled" />
              </template>
              {{ item.replies.length }}
            </NButton>
          </template>
          回复
        </NTooltip>
      </NFlex>
      <NCard v-if="item.replies.length > 0" size="small">
        <NFlex vertical>
          <ForumReplyItem
            v-for="reply in item.replies"
            :key="reply.id"
            :item="reply"
            :comment="item"
            :topic="topic"
            showReplyButton
            :reply-to="reply.replyTo ? item.replies.find((r) => r.id === reply.replyTo) : undefined"
          />
        </NFlex>
      </NCard>
    </NFlex>
  </NFlex>
</template>
