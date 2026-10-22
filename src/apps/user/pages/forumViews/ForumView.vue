<script setup lang="ts">
import { format } from 'date-fns'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { UserInfo } from '@/api/api-models'
import type { ForumPostTopicModel, ForumTopicBaseModel } from '@/api/models/forum'
import { ForumTopicSortTypes, ForumUserLevels } from '@/api/models/forum'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import VEditor from '@/apps/user/components/VEditor.vue'
import { refreshCaptcha } from '@/shared/captcha'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { useForumStore } from '@/store/useForumStore'

import ForumPreviewItem from './ForumPreviewItem.vue'

const { userInfo } = defineProps<{
  userInfo: UserInfo | undefined
}>()
const accountInfo = useAccount()
const token = ref('')
const turnstile = ref()
const editor = ref()

const postTopicBackup = usePersistedStorage<{ [key: number]: ForumPostTopicModel }>('Forum.PostTopic', {})
const showPostTopicModal = ref(false)
const currentPostTopicModel = ref<ForumPostTopicModel>({} as ForumPostTopicModel)
const lastBackupTopic = ref(Date.now())

const useForum = useForumStore()
const ps = ref(20)
const pn = ref(1)
const sort = ref(ForumTopicSortTypes.Time)

const forumInfo = ref<Awaited<ReturnType<typeof useForum.GetForumInfo>>>()
const forumLoading = ref(true)
const topics = ref<{ data: ForumTopicBaseModel[]; total: number; more: boolean }>()

async function ApplyToForum() {
  if (!forumInfo.value) return
  if (await useForum.ApplyToForum(forumInfo.value.owner.id ?? -1)) {
    forumInfo.value.isApplied = true
  }
}
function backupTopic() {
  if (!showPostTopicModal.value) {
    return
  }
  postTopicBackup.value[forumInfo.value?.owner.id ?? -1] = currentPostTopicModel.value
  lastBackupTopic.value = Date.now()
}
function postTopic() {
  currentPostTopicModel.value.owner = forumInfo.value?.owner.id ?? -1
  useForum
    .PostTopic(currentPostTopicModel.value, token.value, () => refreshCaptcha(turnstile.value))
    .then(async (topic) => {
      if (topic) {
        currentPostTopicModel.value = {} as ForumPostTopicModel
        delete postTopicBackup.value[forumInfo.value?.owner.id ?? -1]
        showPostTopicModal.value = false
        topics.value = await useForum.GetTopics(forumInfo.value?.owner.id ?? -1, ps.value, pn.value, sort.value)
      }
    })
    .finally(() => {
      token.value = ''
      turnstile.value?.reset()
    })
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  forumInfo.value = await useForum.GetForumInfo(userInfo?.id ?? -1)
  if (forumInfo.value) {
    topics.value = await useForum.GetTopics(forumInfo.value.owner.id ?? -1, ps.value, pn.value, sort.value)
    if (postTopicBackup.value[forumInfo.value.owner.id ?? -1]) {
      currentPostTopicModel.value = postTopicBackup.value[forumInfo.value.owner.id ?? -1]
    }
  }
  forumLoading.value = false
})

watch(showPostTopicModal, (open) => {
  if (open) {
    token.value = ''
    timer = setInterval(() => {
      backupTopic()
    }, 10000)
  } else {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div
    v-if="forumLoading"
    class="py-24 flex justify-center"
  >
    <Spin />
  </div>

  <Card
    v-else-if="!forumInfo"
    class="max-w-2xl mx-auto shadow-xs"
  >
    <CardContent class="p-6">
      <Alert variant="destructive">
        <AlertDescription class="text-xs"> 用户未创建粉丝讨论区 </AlertDescription>
      </Alert>
    </CardContent>
  </Card>

  <Card
    v-else-if="
      (forumInfo.level < ForumUserLevels.Member && forumInfo.settings.requireApply) ||
      forumInfo.settings.allowedViewerLevel > forumInfo.level
    "
    class="max-w-2xl mx-auto shadow-xs"
  >
    <CardContent class="p-6 space-y-4">
      <Alert>
        <AlertDescription class="text-xs"> 你需要成为成员才能访问 {{ forumInfo.name }} </AlertDescription>
      </Alert>

      <Alert
        v-if="forumInfo.isApplied"
        class="bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
      >
        <AlertDescription class="text-xs"> 已申请, 正在等待管理员审核 </AlertDescription>
      </Alert>

      <Card
        v-else
        class="border border-border/80 shadow-none"
      >
        <CardHeader class="p-4 pb-2">
          <CardTitle class="text-sm font-semibold">加入该讨论区</CardTitle>
        </CardHeader>
        <CardContent class="p-4 pt-2 space-y-3">
          <Alert
            v-if="!accountInfo.id"
            variant="destructive"
          >
            <AlertDescription class="text-xs"> 需要登录后才能够加入 </AlertDescription>
          </Alert>
          <Alert v-else-if="forumInfo.settings.requireApply">
            <AlertDescription class="text-xs"> 申请需要审核 </AlertDescription>
          </Alert>
          <Alert
            v-else
            class="bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
          >
            <AlertDescription class="text-xs"> 该讨论区可直接加入 </AlertDescription>
          </Alert>
          <Separator />
          <Button
            :disabled="!accountInfo.id || useForum.isLoading"
            @click="ApplyToForum"
          >
            {{ forumInfo.settings.requireApply ? '申请' : '' }}加入
          </Button>
        </CardContent>
      </Card>
    </CardContent>
  </Card>

  <template v-else>
    <div class="forum-container max-w-5xl mx-auto space-y-4 py-4 px-2">
      <Card class="shadow-xs">
        <CardHeader class="p-4">
          <CardTitle class="text-base font-bold text-foreground">{{ forumInfo.name }}</CardTitle>
        </CardHeader>
      </Card>

      <div class="forum-grid grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 items-start">
        <Card class="forum-sidebar shadow-xs">
          <CardContent class="p-4 space-y-3">
            <Button
              class="w-full"
              @click="showPostTopicModal = true"
            >
              发布话题
            </Button>
            <Badge
              v-if="forumInfo.isAdmin"
              variant="secondary"
              class="w-full justify-center py-1 text-[11px] font-normal"
            >
              你是管理员
            </Badge>
          </CardContent>
        </Card>

        <Card class="forum-topics shadow-xs">
          <CardContent class="p-0">
            <Empty
              v-if="!topics?.data?.length"
              description="讨论区暂无话题"
              class="py-16"
            />
            <div
              v-else
              class="divide-y divide-border/50"
            >
              <div
                v-for="item in topics?.data ?? []"
                :key="item.id"
                class="topic-row p-3 hover:bg-muted/30 transition"
              >
                <a
                  class="block text-inherit no-underline"
                  :href="`${$route.path}/topic/${item.id}`"
                  target="_blank"
                >
                  <ForumPreviewItem
                    :item="item"
                    :forum="forumInfo"
                  />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- 发帖弹窗 -->
    <Dialog v-model:open="showPostTopicModal">
      <DialogContent class="sm:max-w-3xl max-h-[90vh] flex flex-col p-4 gap-3">
        <DialogHeader class="pb-2 border-b border-border/60">
          <div class="flex items-center gap-2">
            <DialogTitle class="text-sm font-semibold">发布话题</DialogTitle>
            <Separator
              orientation="vertical"
              class="h-3.5"
            />
            <span class="text-[11px] text-muted-foreground font-mono">
              保存于 {{ format(lastBackupTopic, 'HH:mm:ss') }}
            </span>
          </div>
        </DialogHeader>

        <div class="flex-1 min-h-0 overflow-y-auto space-y-3">
          <Input
            v-model="currentPostTopicModel.title"
            placeholder="话题标题"
          />
          <VEditor
            ref="editor"
            v-model:value="currentPostTopicModel.content"
            :max-length="2333"
          />
          <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
            <CaptchaWidget
              v-if="showPostTopicModal"
              ref="turnstile"
              v-model="token"
              class="forum-captcha"
            />
            <Button
              :disabled="!token || useForum.isLoading"
              @click="postTopic"
            >
              发布
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </template>
</template>


