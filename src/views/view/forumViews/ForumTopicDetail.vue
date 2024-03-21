<script setup lang="ts">
import { getUserAvatarUrl } from '@/Utils'
import { UserInfo } from '@/api/api-models'
import { ForumCommentModel, ForumCommentSortTypes, ForumTopicModel } from '@/api/models/forum'
import '@/assets/forumContentStyle.css'
import TurnstileVerify from '@/components/TurnstileVerify.vue'
import VEditor from '@/components/VEditor.vue'
import { VTSURU_API_URL } from '@/data/constants'
import { useForumStore } from '@/store/useForumStore'
import { ArrowCircleLeft12Filled, ArrowCircleLeft12Regular, Comment24Regular, Eye24Regular } from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
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
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ForumCommentItem from './ForumCommentItem.vue'
import ForumReplyItem from './ForumReplyItem.vue'
import { useAccount } from '@/api/account'

type PostCommentModel = {
  content: string
  topic: number
}
type PostReplyModel = {
  content: string
  comment: number
  replyTo?: number
}

const { biliInfo, userInfo } = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  biliInfo: any | undefined
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
const comments = ref<ForumCommentModel[]>([])
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
        comments.value = (await useForum.GetComments(topic.value.id, pn.value, ps.value, sort.value)) ?? []
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
        comments.value = (await useForum.GetComments(topic.value.id, pn.value, ps.value, sort.value)) ?? []
        currentReplyContent.value = {} as PostReplyModel
        useForum.SetReplyingComment()
      }
    })
    .finally(() => {
      turnstile.value?.reset()
    })
}

onMounted(async () => {
  if (route.params.topicId) {
    topicId.value = route.params.topicId as unknown as number
    topic.value = (await useForum.GetTopicDetail(topicId.value)) ?? ({ id: -1 } as ForumTopicModel)
    comments.value = (await useForum.GetComments(topicId.value, pn.value, ps.value, sort.value)) ?? []
  }
})
</script>

<template>
  <template v-if="!topic.id"> </template>
  <template v-else>
    <div size="small" embedded style="max-width: 1500px; margin: 0 auto">
      <NBackTop />
      <NBadge class="back-forum-badge" style="width: 100%; left: 0" type="info" :offset="[3, 3]">
        <NCard size="small">
          <NText style="font-size: large; font-weight: bold; text-align: center; width: 100%">
            <NEllipsis style="width: 100%">
              {{ topic.title }}
            </NEllipsis>
          </NText>
        </NCard>
        <template #value>
          <NTooltip>
            <template #trigger>
              <NButton text @click="() => $router.push({ name: 'user-forum', params: { id: userInfo?.name } })">
                <template #icon>
                  <NIcon :component="ArrowCircleLeft12Regular" color="white" />
                </template>
              </NButton>
            </template>
            返回
          </NTooltip>
        </template>
      </NBadge>
      <NCard content-style="padding: 0 12px 0 12px;" embedded>
        <template #header>
          <NFlex align="center" :size="5">
            <NAvatar
              :src="VTSURU_API_URL + 'user-face/' + topic?.user?.id + '?size=64'"
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
                <NTime :time="topic.createAt" type="relative" />
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
                <NButton size="small" :bordered="topic.isLiked" text>
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
                  @click="
                    useForum.LikeTopic(topic.id, !topic.isLiked).then((success) => {
                      if (success) {
                        topic.isLiked = !topic.isLiked
                        topic.likeCount += topic.isLiked ? 1 : -1
                      }
                    })
                  "
                  :bordered="topic.isLiked"
                  secondary
                  :type="topic.isLiked ? 'primary' : 'default'"
                  :loading="useForum.isLikeLoading"
                  :disabled="!canOprate"
                >
                  <template #icon>
                    <NIcon :component="topic.isLiked ? Heart : HeartOutline" :color="topic.isLiked ? '#dd484f' : ''" />
                  </template>
                  {{ topic.likeCount }}
                </NButton>
              </template>
              点赞
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton size="small" @click="showCommentModal = true" secondary :disabled="!canOprate">
                  <template #icon>
                    <NIcon :component="Comment24Regular" />
                  </template>
                  {{ topic.commentCount }}
                </NButton>
              </template>
              评论
            </NTooltip>
          </NFlex>
        </template>
        <div class="editor-content-view" v-html="topic.content"></div>
      </NCard>
      <NDivider>
        <NButton @click="showCommentModal = true" type="primary" :disabled="!canOprate">发送评论</NButton>
      </NDivider>
      <NEmpty v-if="comments.length === 0" description="暂无评论" />
      <NList v-else hoverable bordered size="small">
        <NListItem v-for="item in comments" :key="item.id">
          <ForumCommentItem :item="item" :topic="topic" />
        </NListItem>
      </NList>
      <NDivider />
    </div>
  </template>
  <NModal v-model:show="showCommentModal" preset="card" style="width: 1000px; max-width: 90vw; height: auto">
    <template #header> 发送评论 </template>
    <VEditor v-model:value="currentCommentContent.content" :max-length="1111" ref="editorRef" />
    <NButton type="primary" @click="postComment" :loading="!token || useForum.isLoading"> 发布 </NButton>
  </NModal>
  <NModal v-model:show="useForum.showReplyModal" preset="card" style="width: 1000px; max-width: 90vw; height: auto">
    <template #header> 发送回复 </template>
    <template v-if="useForum.replyingReply">
      <NCard size="small" title="正在回复" embedded>
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
    <NButton type="primary" @click="postReply" :loading="!token || useForum.isLoading"> 发布 </NButton>
  </NModal>
  <TurnstileVerify ref="turnstile" v-model="token" />
</template>

<style>
.n-badge-sup {
  left: 0 !important;
}
</style>
