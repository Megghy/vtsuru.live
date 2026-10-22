<script setup lang="ts">
import { ArrowSync24Filled, Delete24Filled, Link24Filled, Share24Filled } from '@vicons/fluent'
import { TrashBin } from '@vicons/ionicons5'
import {  useMessage  } from '@/shared/utils'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import type { QAInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import router from '@/app/router'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import QuestionBoxOBSModal from '@/apps/manage/components/question-box/QuestionBoxOBSModal.vue'
import QuestionBoxReceivedTab from '@/apps/manage/components/question-box/QuestionBoxReceivedTab.vue'
import QuestionBoxReplyModal from '@/apps/manage/components/question-box/QuestionBoxReplyModal.vue'
import QuestionBoxSettings from '@/apps/manage/components/question-box/QuestionBoxSettings.vue'
import QuestionBoxShareModal from '@/apps/manage/components/question-box/QuestionBoxShareModal.vue'
import QuestionItem from '@/components/QuestionItem.vue'
import { CURRENT_HOST } from '@/shared/config'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader } from '@/shared/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useQuestionBox } from '@/store/useQuestionBox'

const accountInfo = useAccount()
const route = useRoute()
const message = useMessage()
const useQB = useQuestionBox()

const selectedTabItem = ref(route.query.send ? '1' : '0')
const replyModalVisible = ref(false)
const shareModalVisible = ref(false)
const showOBSModal = ref(false)

const selectedDirectShareTag = ref<string | null>(null)
const directShareUrl = computed(() => {
  const base = `${CURRENT_HOST}@${accountInfo.value?.name}/question-box`
  return selectedDirectShareTag.value ? `${base}?tag=${selectedDirectShareTag.value}` : base
})

function onOpenReply(question: QAInfo) {
  useQB.currentQuestion = question
  replyModalVisible.value = true
}

async function refresh() {
  if (selectedTabItem.value === '0' || selectedTabItem.value === '2') await useQB.GetRecieveQAInfo()
  if (selectedTabItem.value === '1') await useQB.GetSendQAInfo()
  message.success('已刷新')
}

watch(selectedTabItem, (tab) => {
  if (tab === '1' && useQB.sendQuestions.length === 0) useQB.GetSendQAInfo()
})

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return '-'
  const ts = typeof timestamp === 'number' && timestamp < 1e12 ? timestamp * 1000 : timestamp
  const diffSec = Math.floor((Date.now() - ts) / 1000)
  if (diffSec < 60) return '刚刚'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`
  return `${Math.floor(diffSec / 86400)}天前`
}

onMounted(async () => {
  await useQB.GetTags()
  await useQB.GetRecieveQAInfo()
})
</script>

<template>
  <div
    v-if="accountInfo"
    class="space-y-4 w-full"
  >
    <ManagePageHeader
      title="提问箱管理"
      subtitle="收集观众的匿名提问并互动回复，支持话题标签分类、公开展示与 OBS 弹幕投屏"
      :function-type="FunctionTypes.QuestionBox"
      :loading="useQB.isLoading"
      :links="[{ label: '我的提问链接', value: directShareUrl }]"
    >
      <template #action>
        <div class="flex items-center gap-1.5 flex-wrap">
          <Button size="icon-sm" variant="outline" :loading="useQB.isLoading" title="刷新" @click="refresh">
            <component
              :is="ArrowSync24Filled"
              class="h-3.5 w-3.5"
            />
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button size="icon-sm" variant="outline" @click="shareModalVisible = true">
                  <component
                    :is="Share24Filled"
                    class="h-3.5 w-3.5"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent class="text-xs">
                分享提问箱
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button variant="outline" @click="showOBSModal = true">
            OBS 组件
          </Button>

          <Button variant="default" @click="router.push({ name: 'user-questionBox', params: { id: accountInfo.name } })">
            <component
              :is="Link24Filled"
              class="h-3.5 w-3.5 mr-1"
            />
            前往提问页
          </Button>
        </div>
      </template>

      <template #links-extra>
        <Select v-model="selectedDirectShareTag">
          <SelectTrigger class="w-40">
            <SelectValue placeholder="附加话题 (可选)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="tag in useQB.tags.filter((t) => t.visiable)"
              :key="tag.name"
              :value="tag.name"
            >
              {{ tag.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </template>
    </ManagePageHeader>

    <!-- 主要内容 Tabs -->
    <Tabs
      v-model="selectedTabItem"
      class="w-full"
    >
      <TabsList class="grid w-full grid-cols-4 max-w-lg">
        <TabsTrigger value="0">
          我收到的
          <Badge
            variant="secondary"
            size="xs"
          >
            {{ useQB.recieveQuestionsFiltered.length }}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="1">
          我发送的
          <Badge
            variant="secondary"
            size="xs"
          >
            {{ useQB.sendQuestions.length }}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="2">
          <component
            :is="TrashBin"
            class="h-3.5 w-3.5"
          />
          垃圾站
          <Badge
            v-if="useQB.trashQuestions.length > 0"
            variant="warning"
            size="xs"
          >
            {{ useQB.trashQuestions.length }}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="3">
          设置
        </TabsTrigger>
      </TabsList>

      <!-- 我收到的 Tab -->
      <TabsContent
        value="0"
        class="mt-3"
      >
        <QuestionBoxReceivedTab @reply="onOpenReply" />
      </TabsContent>

      <!-- 我发送的 Tab -->
      <TabsContent
        value="1"
        class="mt-3 space-y-3"
      >
        <div
          v-if="useQB.sendQuestions.length === 0"
          class="text-center py-16 text-xs text-muted-foreground border border-dashed rounded-lg"
        >
          暂无发送的提问
        </div>

        <div
          v-else
          class="space-y-3"
        >
          <Card
            v-for="item in useQB.sendQuestions"
            :key="item.id"
            class="hover:border-brand/30 transition-colors"
          >
            <CardHeader class="p-3.5 pb-2">
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    class="text-[10px] px-1 py-0 h-4"
                  >
                    发给
                  </Badge>
                  <Button variant="link" class="h-auto p-0 font-semibold text-primary" @click="router.push(`/user/${item.target.id}`)">
                    {{ item.target.name }}
                  </Button>
                </div>

                <span class="text-muted-foreground font-mono">
                  {{ formatRelativeTime(item.sendAt) }}
                </span>
              </div>
            </CardHeader>

            <CardContent class="p-3.5 pt-0 space-y-3">
              <p class="text-sm text-foreground leading-relaxed m-0">
                {{ item.question?.message }}
              </p>

              <!-- 对方回复 -->
              <div
                v-if="item.answer"
                class="p-3 rounded-md bg-muted/40 border border-border/60 space-y-1.5"
              >
                <div class="flex items-center justify-between text-xs text-muted-foreground">
                  <span class="font-medium">对方的回复</span>
                  <span
                    v-if="item.answer.createdAt"
                    class="font-mono text-[11px]"
                  >
                    {{ formatRelativeTime(item.answer.createdAt) }}
                  </span>
                </div>
                <p class="text-xs text-foreground leading-relaxed m-0">
                  {{ item.answer.message }}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <!-- 垃圾站 Tab -->
      <TabsContent
        value="2"
        class="mt-3 space-y-3"
      >
        <div
          v-if="useQB.trashQuestions.length === 0"
          class="text-center py-16 text-xs text-muted-foreground border border-dashed rounded-lg"
        >
          暂无被过滤的提问
        </div>

        <div
          v-else
          class="space-y-2.5"
        >
          <QuestionItem
            v-for="question in useQB.trashQuestions"
            :key="question.id"
            :item="question"
          >
            <template #footer="{ item }">
              <div class="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button size="xs" variant="outline" class="text-primary" @click="useQB.markAsNormal(item)">
                  标记为正常
                </Button>
                <Button size="xs" variant="outline" class="text-amber-500 border-amber-500/40 hover:bg-amber-500/10" @click="useQB.blacklist(item)">
                  拉黑提问者
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger as-child>
                    <Button size="xs" variant="destructive">
                      <component
                        :is="Delete24Filled"
                        class="h-3.5 w-3.5 mr-1"
                      />
                      彻底删除
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent class="sm:max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>彻底删除此提问？</AlertDialogTitle>
                      <AlertDialogDescription class="text-xs">
                        删除后将无法恢复该提问内容。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        @click="useQB.DelQA(item.id)"
                      >
                        确认彻底删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </template>
            <template #header-extra />
          </QuestionItem>
        </div>
      </TabsContent>

      <!-- 设置 Tab -->
      <TabsContent
        value="3"
        class="mt-3"
      >
        <QuestionBoxSettings />
      </TabsContent>
    </Tabs>
  </div>
  <div
    v-else
    class="text-center py-20 text-xs text-muted-foreground"
  >
    正在加载账户信息...
  </div>

  <!-- 模态框 -->
  <QuestionBoxReplyModal v-model:show="replyModalVisible" />
  <QuestionBoxShareModal v-model:show="shareModalVisible" />
  <QuestionBoxOBSModal v-model:show="showOBSModal" />
</template>
