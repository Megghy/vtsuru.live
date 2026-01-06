<script setup lang="ts">
import type { PaginationResponse, UserInfo } from '@/api/api-models'
import type { ForumCommentModel, ForumTopicModel } from '@/api/models/forum'
import {
  ArrowCircleLeft12Regular,
  Comment24Regular,
  Delete24Filled,
  Eye24Regular,
} from '@vicons/fluent'
import { Heart, HeartOutline, SyncCircleSharp } from '@vicons/ionicons5'
import {
  NAvatar,
  NAvatarGroup,
  NBackTop,
  NBadge,
  NButton,
  NCard,
  NDivider,
  NEllipsis,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NList,
  NListItem,
  NModal,
  NPagination,
  NPopconfirm,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAccount } from '@/api/account'
import { ForumCommentSortTypes } from '@/api/models/forum'
import TurnstileVerify from '@/apps/user/components/TurnstileVerify.vue'
import VEditor from '@/apps/user/components/VEditor.vue'
import { VTSURU_API_URL } from '@/shared/config'
import router from '@/app/router'
import { useForumStore } from '@/store/useForumStore'
import { getUserAvatarUrl } from '@/shared/utils'
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
const message = useMessage()
const accountInfo = useAccount()

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
    message.error('评论内容不能为空')
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
    message.error('回复内容不能为空')
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
    comments.value.data = comments.value.data.filter(c => c.id !== id)
  }
}
async function delTopic(topicId: number) {
  useForum.DelTopic(topicId).then((success) => {
    if (success) {
      setTimeout(() => {
        router.push({ name: 'user-forum', params: { id: userInfo?.name } })
      })
    }
  })
}
async function restoreTopic(topicId: number) {
  useForum.RestoreTopic(topicId).then((success) => {
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
    <div
      size="small"
      embedded
      style="max-width: 1500px; margin: 0 auto"
    >
      <NBackTop />
      <NBadge
        class="back-forum-badge"
        style="width: 100%; left: 0"
        type="info"
        :offset="[3, 3]"
      >
        <NCard size="small">
          <NFlex
            align="center"
            :wrap="false"
          >
            <NTag
              v-if="topic.isDeleted"
              type="warning"
              :bordered="false"
            >
              已删除
            </NTag>
            <NText style="font-size: large; font-weight: bold; text-align: center; width: 100%">
              <NEllipsis style="width: 100%">
                {{ topic.title }}
              </NEllipsis>
            </NText>
          </NFlex>
        </NCard>
        <template #value>
          <NTooltip>
            <template #trigger>
              <NButton
                text
                @click="() => $router.push({ name: 'user-forum', params: { id: userInfo?.name } })"
              >
                <template #icon>
                  <NIcon
                    :component="ArrowCircleLeft12Regular"
                    color="white"
                  />
                </template>
              </NButton>
            </template>
            返回
          </NTooltip>
        </template>
      </NBadge>
      <NCard
        content-style="padding: 0 12px 0 12px;"
        embedded
      >
        <template #header>
          <NFlex
            align="center"
            :size="5"
          >
            <NAvatar
              :src="`${VTSURU_API_URL}user-face/${topic?.user?.id}?size=64`"
              :img-props="{ referrerpolicy: 'no-referrer' }"
            />
            <NDivider vertical />
            {{ topic.user?.name }}
          </NFlex>
        </template>
        <template #header-extra>
          <NTooltip>
            <template #trigger>
              <NText depth="3">
                <NTime
                  :time="topic.createAt"
                  type="relative"
                />
              </NText>
            </template>
            <NTime :time="topic.createAt" />
          </NTooltip>
        </template>
        <template #footer>
          <NAvatarGroup
            :size="30"
            :options="topic.sampleLikedBy?.map((u) => ({ src: getUserAvatarUrl(u) })) ?? []"
            :img-props="{ referrerpolicy: 'no-referrer' }"
          />
          <NDivider style="margin: 5px 0 10px 0" />
          <NFlex>
            <NTooltip>
              <template #trigger>
                <NButton
                  size="small"
                  :bordered="topic.isLiked"
                  text
                >
                  <template #icon>
                    <NIcon :component="Eye24Regular" />
                  </template>
                  {{ topic.viewCount }}
                </NButton>
              </template>
              浏览
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton
                  size="small"
                  :bordered="topic.isLiked"
                  secondary
                  :type="topic.isLiked ? 'primary' : 'default'"
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
                  <template #icon>
                    <NIcon
                      :component="topic.isLiked ? Heart : HeartOutline"
                      :color="topic.isLiked ? '#dd484f' : ''"
                    />
                  </template>
                  {{ topic.likeCount }}
                </NButton>
              </template>
              点赞
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton
                  size="small"
                  secondary
                  :disabled="!canOprate"
                  @click="showCommentModal = true"
                >
                  <template #icon>
                    <NIcon :component="Comment24Regular" />
                  </template>
                  {{ topic.commentCount }}
                </NButton>
              </template>
              评论
            </NTooltip>
            <NFlex
              style="flex: 1"
              justify="end"
            >
              <NTooltip v-if="topic?.user?.id === accountInfo.id || topic.isAdmin">
                <template #trigger>
                  <NPopconfirm @positive-click="delTopic(topic.id)">
                    <template #trigger>
                      <NButton
                        size="small"
                        text
                        :disabled="!canOprate"
                      >
                        <template #icon>
                          <NIcon
                            :component="Delete24Filled"
                            :color="topic.isDeleted || topic.isAdmin ? '#dd484f' : '#7f7f7f'"
                          />
                        </template>
                      </NButton>
                    </template>
                    {{ topic.isDeleted ? '确定完全删除这个话题吗? 这将无法恢复' : '确定删除这个话题吗' }}
                  </NPopconfirm>
                </template>
                {{ topic.isDeleted || topic.isAdmin ? '完全' : '' }}删除
              </NTooltip>
              <NTooltip v-if="topic.isDeleted && topic.isAdmin">
                <template #trigger>
                  <NPopconfirm @positive-click="restoreTopic(topic.id)">
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
                    要恢复这个话题吗?
                  </NPopconfirm>
                </template>
                恢复
              </NTooltip>
            </NFlex>
          </NFlex>
        </template>
        <div
          class="editor-content-view"
          v-html="topic.content"
        />
      </NCard>
      <NDivider>
        <NButton
          type="primary"
          :disabled="!canOprate"
          @click="showCommentModal = true"
        >
          发送评论
        </NButton>
      </NDivider>
      <NFlex
        align="center"
        justify="center"
      >
        <NPagination
          v-if="comments && (comments?.data?.length ?? 0) > 0"
          v-model:page="pn"
          :item-count="comments?.data.length ?? 0"
          :page-size="ps"
          show-quick-jumper
          @update:page="refreshComments"
        />
      </NFlex>
      <br>
      <NEmpty
        v-if="!comments || !comments.data || comments.data.length === 0"
        description="暂无评论"
      />
      <NList
        v-else
        hoverable
        bordered
        size="small"
      >
        <NListItem
          v-for="item in comments.data"
          :key="item.id"
        >
          <ForumCommentItem
            :item="item"
            :topic="topic"
            @delete="onDeleteComment"
          />
        </NListItem>
      </NList>
      <br>
      <NFlex
        v-if="(comments?.data?.length ?? 0) > 5"
        align="center"
        justify="center"
      >
        <NPagination
          v-if="comments && (comments?.data.length ?? 0) > 0"
          v-model:page="pn"
          :item-count="comments?.data.length ?? 0"
          :page-size="ps"
          show-quick-jumper
          @update:page="refreshComments"
        />
      </NFlex>
      <NDivider />
    </div>
  </template>
  <NModal
    v-model:show="showCommentModal"
    preset="card"
    style="width: 1000px; max-width: 90vw; height: auto"
  >
    <template #header>
      发送评论
    </template>
    <VEditor
      ref="editorRef"
      v-model:value="currentCommentContent.content"
      :max-length="1111"
    />
    <NButton
      type="primary"
      :loading="!token || useForum.isLoading"
      @click="postComment"
    >
      发布
    </NButton>
  </NModal>
  <NModal
    v-model:show="useForum.showReplyModal"
    preset="card"
    style="width: 1000px; max-width: 90vw; height: auto"
  >
    <template #header>
      发送回复
    </template>
    <template v-if="useForum.replyingReply">
      <NCard
        size="small"
        title="正在回复"
        embedded
      >
        <ForumReplyItem
          v-if="useForum.replyingReply && useForum.replyingComment"
          :item="useForum.replyingReply"
          :comment="useForum.replyingComment"
          :topic="topic"
          :show-reply-button="false"
        />
      </NCard>
      <NDivider />
    </template>
    <NInput
      v-model:value="currentReplyContent.content"
      type="textarea"
      placeholder="回复内容"
      maxlength="233"
      show-count
    />
    <NDivider />
    <NButton
      type="primary"
      :loading="!token || useForum.isLoading"
      @click="postReply"
    >
      发布
    </NButton>
  </NModal>
  <TurnstileVerify
    ref="turnstile"
    v-model="token"
  />
</template>

<style>
.n-badge-sup {
  left: 0 !important;
}
</style>
