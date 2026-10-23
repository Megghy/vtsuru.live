<script setup lang="ts">
import { ArrowCircleLeft12Regular, Comment24Regular, Eye24Regular } from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import type { ForumCommentModel, PaginationResponse } from '@/api/client-types'
import type { ResponseForumTopicModel, ResponseUserInfo } from '@/api/generated/model'
import { ForumCommentSortTypes } from '@/api/generated/model'
import type { PaginationResponseOfListOfResponseForumCommentBaseModel } from '@/api/generated/model'
import router from '@/app/router'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import VEditor from '@/apps/user/components/VEditor.vue'
import { refreshCaptcha } from '@/shared/captcha'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Pagination } from '@/shared/ui/pagination'
import { Separator } from '@/shared/ui/separator'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { getUserAvatarUrl, toast } from '@/shared/utils'
import { useForumStore } from '@/store/useForumStore'

import ForumActionBar from './ForumActionBar.vue'
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
  userInfo: ResponseUserInfo | undefined
}>()

const route = useRoute()
const accountInfo = useAccount()

const topicId = ref(-1)
const useForum = useForumStore()

const commentToken = ref('')
const replyToken = ref('')
const commentCaptcha = ref()
const replyCaptcha = ref()
const editorRef = ref()

const showCommentModal = ref(false)
const currentCommentContent = ref<PostCommentModel>({} as PostCommentModel)
const currentReplyContent = ref<PostReplyModel>({} as PostReplyModel)

const comments = ref<PaginationResponseOfListOfResponseForumCommentBaseModel>()
const topic = ref<ResponseForumTopicModel>({} as ResponseForumTopicModel)

const sort = ref<ForumCommentSortTypes>(ForumCommentSortTypes.Time)
const isAsc = ref(false)
const pn = ref(1)
const ps = ref(10)

const commentTotal = computed(() => {
  return comments.value?.total ?? 0
})

const canOprate = computed(() => {
  return !topic.value.isLocked && accountInfo.value.id > 0
})

async function refreshComments() {
  if (topicId.value === -1) return
  comments.value = await useForum.GetComments(topicId.value, pn.value, ps.value, sort.value)
}

async function postComment() {
  if (!commentToken.value) {
    toast.error('请先完成人机验证')
    return
  }

  currentCommentContent.value.topic = topicId.value
  useForum.PostComment(currentCommentContent.value, commentToken.value).then((success) => {
    if (success) {
      showCommentModal.value = false
      currentCommentContent.value = {} as PostCommentModel
      commentToken.value = ''
      refreshComments()
    } else {
      refreshCaptcha(commentCaptcha.value)
    }
  })
}

async function postReply() {
  if (!replyToken.value) {
    toast.error('请先完成人机验证')
    return
  }

  currentReplyContent.value.comment = useForum.replyingComment!.id
  currentReplyContent.value.replyTo = useForum.replyingReply?.id
  useForum.PostReply(currentReplyContent.value, replyToken.value).then((success) => {
    if (success) {
      useForum.showReplyModal = false
      currentReplyContent.value = {} as PostReplyModel
      replyToken.value = ''
      refreshComments()
    } else {
      refreshCaptcha(replyCaptcha.value)
    }
  })
}

function onDeleteComment(id: number) {
  if (comments.value?.data) {
    comments.value.data = comments.value.data.filter((c) => c.id !== id)
  }
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

function formatRelativeTime(time: number) {
  try {
    return formatDistanceToNow(new Date(time), { addSuffix: true, locale: zhCN })
  } catch {
    return String(time)
  }
}

function formatFullTime(time: number) {
  try {
    return format(new Date(time), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return String(time)
  }
}

onMounted(async () => {
  if (route.params.topicId) {
    topicId.value = route.params.topicId as unknown as number
    topic.value = (await useForum.GetTopicDetail(topicId.value)) ?? ({ id: -1 } as ResponseForumTopicModel)
    refreshComments()
  }
})
</script>

<template>
  <TooltipProvider>
    <div
      v-if="topic.id"
      class="forum-topic-detail max-w-4xl mx-auto space-y-4 py-4 px-2"
    >
      <Card class="shadow-xs">
        <CardHeader class="p-3">
          <div class="flex items-center gap-2 text-xs flex-wrap">
            <Button
              variant="ghost"
              class="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              @click="$router.push({ name: 'user-forum', params: { id: userInfo?.name } })"
            >
              <component
                :is="ArrowCircleLeft12Regular"
                class="size-4"
              />
              返回讨论区
            </Button>
            <Separator
              orientation="vertical"
              class="h-4"
            />
            <Badge
              v-if="topic.isDeleted"
              variant="destructive"
              class="text-[10px] h-4.5 px-1.5 font-normal"
            >
              已删除
            </Badge>
            <h1 class="text-sm font-semibold text-foreground truncate max-w-xl">
              {{ topic.title }}
            </h1>
          </div>
        </CardHeader>
      </Card>

      <Card class="shadow-xs">
        <CardHeader class="p-4 pb-2 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
          <div class="flex items-center gap-2.5">
            <Avatar class="size-8 rounded-full">
              <AvatarImage
                :src="getUserAvatarUrl(topic?.user?.id)"
                referrerpolicy="no-referrer"
              />
              <AvatarFallback>{{ topic.user?.name?.charAt(0) }}</AvatarFallback>
            </Avatar>
            <strong class="text-xs font-medium text-foreground">{{ topic.user?.name }}</strong>
          </div>
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="text-[11px] text-muted-foreground cursor-help">
                {{ formatRelativeTime(topic.createAt) }}
              </span>
            </TooltipTrigger>
            <TooltipContent class="text-xs">
              {{ formatFullTime(topic.createAt) }}
            </TooltipContent>
          </Tooltip>
        </CardHeader>

        <CardContent class="p-4 pt-3 space-y-4 text-xs">
          <div
            class="editor-content-view leading-relaxed text-foreground break-words min-h-24"
            v-html="topic.content"
          />

          <div
            v-if="topic.sampleLikedBy?.length"
            class="flex items-center -space-x-1.5 pt-2"
          >
            <Avatar
              v-for="uid in topic.sampleLikedBy.slice(0, 8)"
              :key="uid"
              class="size-6 rounded-full border border-background ring-1 ring-border"
            >
              <AvatarImage
                :src="getUserAvatarUrl(uid)"
                referrerpolicy="no-referrer"
              />
              <AvatarFallback class="text-[9px]">U</AvatarFallback>
            </Avatar>
          </div>
        </CardContent>

        <CardFooter class="p-3 pt-2 border-t border-border/50 flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger as-child>
                <div class="inline-flex items-center gap-1 text-muted-foreground px-2 py-1 text-xs">
                  <component
                    :is="Eye24Regular"
                    class="size-3.5"
                  />
                  <span>{{ topic.viewCount }}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent class="text-xs">浏览量</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="outline"
                  class="flex items-center gap-1"
                  :class="{ 'text-destructive border-destructive/30': topic.isLiked }"
                  :disabled="!canOprate || useForum.isLikeLoading"
                  @click="
                    useForum.LikeTopic(topic.id, !topic.isLiked).then((success) => {
                      if (success) {
                        topic.isLiked = !topic.isLiked
                        topic.likeCount += topic.isLiked ? 1 : -1
                      }
                    })
                  "
                >
                  <component
                    :is="topic.isLiked ? Heart : HeartOutline"
                    class="size-3.5"
                  />
                  <span>{{ topic.likeCount }}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent class="text-xs">点赞</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="outline"
                  class="flex items-center gap-1"
                  :disabled="!canOprate"
                  @click="showCommentModal = true"
                >
                  <component
                    :is="Comment24Regular"
                    class="size-3.5"
                  />
                  <span>{{ topic.commentCount }}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent class="text-xs">评论</TooltipContent>
            </Tooltip>
          </div>

          <ForumActionBar
            :can-operate="canOprate"
            :can-manage="topic?.user?.id === accountInfo.id || topic.isAdmin"
            :is-deleted="topic.isDeleted"
            :is-admin="topic.isAdmin"
            delete-confirm="确定删除这个话题吗"
            hard-delete-confirm="确定完全删除这个话题吗? 这将无法恢复"
            restore-confirm="要恢复这个话题吗?"
            @delete="delTopic(topic.id)"
            @restore="restoreTopic(topic.id)"
          />
        </CardFooter>
      </Card>

      <Card class="shadow-xs">
        <CardHeader class="p-3 pb-2 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
          <strong class="text-xs font-semibold">评论</strong>
          <Button
            :disabled="!canOprate"
            @click="showCommentModal = true"
          >
            发送评论
          </Button>
        </CardHeader>

        <CardContent class="p-4 space-y-3 text-xs">
          <div
            v-if="commentTotal > ps"
            class="flex justify-center pb-2"
          >
            <Pagination
              :total="commentTotal"
              :items-per-page="ps"
              :page="pn"
              @update:page="((pn = $event), refreshComments())"
            />
          </div>

          <Empty
            v-if="!comments || !comments.data || comments.data.length === 0"
            description="暂无评论"
            class="py-10"
          />

          <div
            v-else
            class="space-y-1"
          >
            <ForumCommentItem
              v-for="item in comments.data"
              :key="item.id"
              :item="item as any"
              :topic="topic"
              @delete="onDeleteComment"
            />
          </div>

          <div
            v-if="commentTotal > ps"
            class="flex justify-center pt-3"
          >
            <Pagination
              :total="commentTotal"
              :items-per-page="ps"
              :page="pn"
              @update:page="((pn = $event), refreshComments())"
            />
          </div>
        </CardContent>
      </Card>

      <!-- 评论弹窗 -->
      <Dialog v-model:open="showCommentModal">
        <DialogContent class="sm:max-w-3xl max-h-[90vh] flex flex-col p-4 gap-3">
          <DialogHeader>
            <DialogTitle class="text-sm font-semibold">发送评论</DialogTitle>
          </DialogHeader>

          <div class="flex-1 min-h-0 overflow-y-auto space-y-3">
            <VEditor
              ref="editorRef"
              v-model:value="currentCommentContent.content"
              :max-length="1111"
            />
            <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
              <CaptchaWidget
                v-if="showCommentModal"
                ref="commentCaptcha"
                v-model="commentToken"
                class="forum-captcha"
              />
              <Button
                :disabled="!commentToken || useForum.isLoading"
                @click="postComment"
              >
                发布
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <!-- 回复弹窗 -->
      <Dialog v-model:open="useForum.showReplyModal">
        <DialogContent class="sm:max-w-xl flex flex-col p-4 gap-3">
          <DialogHeader>
            <DialogTitle class="text-sm font-semibold">发送回复</DialogTitle>
          </DialogHeader>

          <div class="space-y-3 text-xs">
            <div
              v-if="useForum.replyingReply && useForum.replyingComment"
              class="p-2.5 rounded-lg border border-border/80 bg-muted/30"
            >
              <small class="text-[10px] text-muted-foreground block mb-1">正在回复:</small>
              <ForumReplyItem
                :item="useForum.replyingReply"
                :comment="useForum.replyingComment"
                :topic="topic"
                :show-reply-button="false"
              />
            </div>

            <Textarea
              v-model="currentReplyContent.content"
              placeholder="回复内容..."
              maxlength="233"
              rows="3"
              class="text-xs resize-none"
            />

            <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
              <CaptchaWidget
                v-if="useForum.showReplyModal"
                ref="replyCaptcha"
                v-model="replyToken"
                class="forum-captcha"
              />
              <Button
                :disabled="!replyToken || useForum.isLoading"
                @click="postReply"
              >
                发布
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </TooltipProvider>
</template>
