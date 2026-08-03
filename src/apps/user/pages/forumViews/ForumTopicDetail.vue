<script setup lang="ts">
import { ArrowCircleLeft12Regular, Comment24Regular, Delete24Filled, Eye24Regular } from '@vicons/fluent'
import { Heart, HeartOutline, SyncCircleSharp } from '@vicons/ionicons5'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import type { PaginationResponse, UserInfo } from '@/api/api-models'
import type { ForumCommentModel, ForumTopicModel } from '@/api/models/forum'
import { ForumCommentSortTypes } from '@/api/models/forum'
import router from '@/app/router'
import PublicTime from '@/apps/user-page/PublicTime.vue'
import TurnstileVerify from '@/apps/user/components/TurnstileVerify.vue'
import VEditor from '@/apps/user/components/VEditor.vue'
import { VTSURU_API_URL } from '@/shared/config'
import { getUserAvatarUrl } from '@/shared/utils'
import { useForumStore } from '@/store/useForumStore'

import ForumCommentItem from './ForumCommentItem.vue'
import ForumReplyItem from './ForumReplyItem.vue'

import '@/assets/forumContentStyle.css'

interface PostCommentModel {
  content: string
  topic: number
}
interface PostReplyModel {
  content: string
  comment: number
  replyTo?: number
}

const { userInfo } = defineProps<{
  userInfo: UserInfo | undefined
}>()

const route = useRoute()
const toast = useToast()
const accountInfo = useAccount()
const accentColor = 'var(--ui-error)'
const mutedIconColor = 'var(--vtsuru-surface-fg-subtle)'

const topicId = ref(-1)
const useForum = useForumStore()

const token = ref('')
const turnstile = ref()
const editorRef = ref()

const showCommentModal = ref(false)
const currentCommentContent = ref<PostCommentModel>({} as PostCommentModel)

const currentReplyContent = ref<PostReplyModel>({} as PostReplyModel)

const topic = ref<ForumTopicModel>({ id: -1 } as ForumTopicModel)
const comments = ref<PaginationResponse<ForumCommentModel[]>>()
const ps = ref(20)
const pn = ref(0)
const sort = ref(ForumCommentSortTypes.Time)

const canOprate = computed(() => {
  return !topic.value.isLocked && accountInfo.value.id > 0
})

async function postComment() {
  if (!topic.value.id) return
  if (!currentCommentContent.value.content) {
    toast.add({ title: '评论内容不能为空', color: 'error' })
    return
  }
  currentCommentContent.value.topic = topic.value.id
  useForum
    .PostComment(currentCommentContent.value, token.value)
    .then(async (comment) => {
      if (comment) {
        setTimeout(async () => {
          refreshComments()
        }, 1000)
        currentCommentContent.value = {} as PostCommentModel
        showCommentModal.value = false
      }
    })
    .finally(() => {
      turnstile.value?.reset()
    })
}
async function postReply() {
  if (!topic.value.id) return
  if (!currentReplyContent.value.content) {
    toast.add({ title: '回复内容不能为空', color: 'error' })
    return
  }
  currentReplyContent.value.comment = useForum.replyingComment?.id ?? -1
  currentReplyContent.value.replyTo = useForum.replyingReply?.id
  useForum
    .PostReply(currentReplyContent.value, token.value)
    .then(async (comment) => {
      if (comment) {
        refreshComments()
        currentReplyContent.value = {} as PostReplyModel
        useForum.SetReplyingComment()
      }
    })
    .finally(() => {
      turnstile.value?.reset()
    })
}
async function refreshComments() {
  comments.value = await useForum.GetComments(topic.value.id, pn.value, ps.value, sort.value)
}
function onDeleteComment(id: number) {
  if (comments.value) {
    comments.value.data = comments.value.data.filter((c) => c.id !== id)
  }
}

function confirmDeleteTopic() {
  const content =
    topic.value.isDeleted || topic.value.isAdmin ? '确定完全删除这个话题吗？这将无法恢复。' : '确定删除这个话题吗？'
  if (window.confirm(content)) delTopic(topic.value.id)
}

function confirmRestoreTopic() {
  if (window.confirm('要恢复这个话题吗？')) restoreTopic(topic.value.id)
}
async function delTopic(id: number) {
  useForum.DelTopic(id).then((success) => {
    if (success) {
      setTimeout(() => {
        router.push({ name: 'user-forum', params: { id: userInfo?.name } })
      })
    }
  })
}
async function restoreTopic(id: number) {
  useForum.RestoreTopic(id).then((success) => {
    if (success) {
      setTimeout(() => {
        topic.value.isDeleted = false
      })
    }
  })
}

onMounted(async () => {
  if (route.params.topicId) {
    topicId.value = route.params.topicId as unknown as number
    topic.value = (await useForum.GetTopicDetail(topicId.value)) ?? ({ id: -1 } as ForumTopicModel)
    refreshComments()
  }
})
</script>

<template>
  <template v-if="!topic.id" />
  <template v-else>
    <div class="forum-topic-detail">
      <div />
      <UCard
        size="small"
        bordered
        class="user-page-card"
      >
        <template #header>
          <div
            align="center"
            :wrap="false"
            :size="8"
          >
            <UButton
              variant="link"
              size="sm"
              @click="() => $router.push({ name: 'user-forum', params: { id: userInfo?.name } })"
            >
              <template #leading>
                <component :is="ArrowCircleLeft12Regular" />
              </template>
              返回讨论区
            </UButton>
            <USeparator vertical />
            <UBadge
              v-if="topic.isDeleted"
              color="warning"
              :bordered="false"
            >
              已删除
            </UBadge>
            <span class="topic-title">
              <span style="max-width: 100%">
                {{ topic.title }}
              </span>
            </span>
          </div>
        </template>
      </UCard>
      <UCard
        size="small"
        bordered
        class="user-page-card"
      >
        <template #header>
          <div
            align="center"
            :size="5"
          >
            <UAvatar
              :src="`${VTSURU_API_URL}user-face/${topic?.user?.id}?size=64`"
              :img-props="{ referrerpolicy: 'no-referrer' }"
            />
            <USeparator vertical />
            {{ topic.user?.name }}
          </div>
        </template>
        <template #header-extra>
          <UTooltip>
            <span depth="3">
              <PublicTime
                :time="topic.createAt"
                type="relative"
              />
            </span>

            <template #content><PublicTime :time="topic.createAt" /></template>
          </UTooltip>
        </template>
        <template #footer>
          <div
            :size="30"
            :options="topic.sampleLikedBy?.map((u) => ({ src: getUserAvatarUrl(u) })) ?? []"
            :img-props="{ referrerpolicy: 'no-referrer' }"
          />
          <USeparator style="margin: 5px 0 10px 0" />
          <div>
            <UTooltip>
              <UButton
                size="sm"
                :bordered="topic.isLiked"
                variant="link"
              >
                <template #leading>
                  <component :is="Eye24Regular" />
                </template>
                {{ topic.viewCount }}
              </UButton>
              <template #content> 浏览 </template></UTooltip
            >
            <UTooltip>
              <UButton
                size="sm"
                :bordered="topic.isLiked"
                variant="soft"
                :color="topic.isLiked ? 'primary' : 'neutral'"
                :loading="useForum.isLikeLoading"
                :disabled="!canOprate"
                @click="
                  useForum.LikeTopic(topic.id, !topic.isLiked).then((success) => {
                    if (success) {
                      topic.isLiked = !topic.isLiked
                      topic.likeCount += topic.isLiked ? 1 : -1
                    }
                  })
                "
              >
                <template #leading>
                  <component
                    :is="topic.isLiked ? Heart : HeartOutline"
                    :color="topic.isLiked ? accentColor : undefined"
                  />
                </template>
                {{ topic.likeCount }}
              </UButton>
              <template #content> 点赞 </template></UTooltip
            >
            <UTooltip>
              <UButton
                size="sm"
                variant="soft"
                :disabled="!canOprate"
                @click="showCommentModal = true"
              >
                <template #leading>
                  <component :is="Comment24Regular" />
                </template>
                {{ topic.commentCount }}
              </UButton>
              <template #content> 评论 </template></UTooltip
            >
            <div
              style="flex: 1"
              justify="end"
            >
              <UTooltip v-if="topic?.user?.id === accountInfo.id || topic.isAdmin">
                <UButton
                  size="sm"
                  variant="link"
                  :disabled="!canOprate"
                  @click="confirmDeleteTopic"
                >
                  <template #leading>
                    <component
                      :is="Delete24Filled"
                      :color="topic.isDeleted || topic.isAdmin ? accentColor : mutedIconColor"
                    />
                  </template>
                </UButton>

                <template #content>{{ topic.isDeleted || topic.isAdmin ? '完全' : '' }}删除 </template></UTooltip
              >
              <UTooltip v-if="topic.isDeleted && topic.isAdmin">
                <UButton
                  size="sm"
                  variant="link"
                  :disabled="!canOprate"
                  @click="confirmRestoreTopic"
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
        </template>
        <div
          class="editor-content-view"
          v-html="topic.content"
        />
      </UCard>
      <UCard
        size="small"
        bordered
        class="user-page-card"
      >
        <template #header> 评论 </template>
        <template #header-extra>
          <UButton
            color="primary"
            size="sm"
            :disabled="!canOprate"
            @click="showCommentModal = true"
          >
            发送评论
          </UButton>
        </template>
        <div
          align="center"
          justify="center"
          style="padding-top: 6px"
        >
          <UPagination
            v-if="comments && (comments?.data?.length ?? 0) > 0"
            v-model:page="pn"
            :total="comments?.data.length ?? 0"
            :items-per-page="ps"
            @update:page="refreshComments"
          />
        </div>
        <div style="height: 12px" />
        <UEmpty
          v-if="!comments || !comments.data || comments.data.length === 0"
          description="暂无评论"
          class="public-empty"
        />
        <ul
          v-else
          hoverable
          size="small"
        >
          <li
            v-for="item in comments.data"
            :key="item.id"
          >
            <ForumCommentItem
              :item="item"
              :topic="topic"
              @delete="onDeleteComment"
            />
          </li>
        </ul>
        <div style="height: 12px" />
        <div
          v-if="(comments?.data?.length ?? 0) > 5"
          align="center"
          justify="center"
        >
          <UPagination
            v-if="comments && (comments?.data.length ?? 0) > 0"
            v-model:page="pn"
            :total="comments?.data.length ?? 0"
            :items-per-page="ps"
            @update:page="refreshComments"
          />
        </div>
      </UCard>
    </div>
  </template>
  <UModal
    v-model:open="showCommentModal"
    :ui="{ content: 'max-w-[1000px]' }"
  >
    <template #header> 发送评论 </template>
    <template #body>
      <VEditor
        ref="editorRef"
        v-model:value="currentCommentContent.content"
        :max-length="1111"
      />
      <UButton
        color="primary"
        :loading="!token || useForum.isLoading"
        @click="postComment"
      >
        发布
      </UButton>
    </template>
  </UModal>
  <UModal
    v-model:open="useForum.showReplyModal"
    :ui="{ content: 'max-w-[1000px]' }"
  >
    <template #header> 发送回复 </template>
    <template #body>
      <template v-if="useForum.replyingReply">
        <UCard
          size="small"
          title="正在回复"
          variant="soft"
          class="user-page-card"
        >
          <ForumReplyItem
            v-if="useForum.replyingReply && useForum.replyingComment"
            :item="useForum.replyingReply"
            :comment="useForum.replyingComment"
            :topic="topic"
            :show-reply-button="false"
          />
        </UCard>
        <USeparator />
      </template>
      <UTextarea
        v-model="currentReplyContent.content"
        placeholder="回复内容"
        maxlength="233"
        show-count
      />
      <USeparator />
      <UButton
        color="primary"
        :loading="!token || useForum.isLoading"
        @click="postReply"
      >
        发布
      </UButton>
    </template>
  </UModal>
  <TurnstileVerify
    ref="turnstile"
    v-model="token"
  />
</template>

<style scoped>
.forum-topic-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.topic-title {
  width: 100%;
  font-size: 16px;
  font-weight: 700;
}
</style>
