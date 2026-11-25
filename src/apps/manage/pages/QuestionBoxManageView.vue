<script setup lang="ts">
import { Ban, CheckCircle2, ExternalLink, RefreshCw, Share2, Trash2 } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/generated/model'
import type { ResponseQAInfoToTarget } from '@/api/generated/model'
import router from '@/app/router'
import QuestionBoxOBSModal from '@/apps/manage/components/question-box/QuestionBoxOBSModal.vue'
import QuestionBoxReceivedTab from '@/apps/manage/components/question-box/QuestionBoxReceivedTab.vue'
import QuestionBoxReplyModal from '@/apps/manage/components/question-box/QuestionBoxReplyModal.vue'
import QuestionBoxSentTab from '@/apps/manage/components/question-box/QuestionBoxSentTab.vue'
import QuestionBoxSettings from '@/apps/manage/components/question-box/QuestionBoxSettings.vue'
import QuestionBoxShareModal from '@/apps/manage/components/question-box/QuestionBoxShareModal.vue'
import QuestionExportCardModal from '@/apps/manage/components/question-box/QuestionExportCardModal.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import QuestionItem from '@/components/QuestionItem.vue'
import { CURRENT_HOST } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'
import { useQuestionBox } from '@/store/useQuestionBox'

const accountInfo = useAccount()
const route = useRoute()
const message = useMessage()
const useQB = useQuestionBox()

const selectedTabItem = ref(route.query.send ? '1' : '0')
const replyModalVisible = ref(false)
const shareModalVisible = ref(false)
const showOBSModal = ref(false)
const exportCardVisible = ref(false)
const exportCardQuestion = ref<ResponseQAInfoToTarget>()

const selectedDirectShareTag = ref<string>('__none__')
const directShareUrl = computed(() => {
  const name = accountInfo.value?.name
  if (!name) return ''
  const host = CURRENT_HOST.endsWith('/') ? CURRENT_HOST : `${CURRENT_HOST}/`
  const base = `${host}@${encodeURIComponent(name)}/question-box`
  return selectedDirectShareTag.value && selectedDirectShareTag.value !== '__none__'
    ? `${base}?tag=${encodeURIComponent(selectedDirectShareTag.value)}`
    : base
})

function onOpenReply(question: ResponseQAInfoToTarget) {
  useQB.currentQuestion = question
  replyModalVisible.value = true
}

function onOpenExportCard(question: ResponseQAInfoToTarget) {
  exportCardQuestion.value = question
  exportCardVisible.value = true
}

function canBlacklistQuestion(item: ResponseQAInfoToTarget) {
  return (!item.isAnonymous && Boolean(item.sender?.id)) || Boolean(item.canBlacklistAnonymous)
}

async function refresh() {
  if (selectedTabItem.value === '0' || selectedTabItem.value === '2') await useQB.GetRecieveQAInfo()
  if (selectedTabItem.value === '1') await useQB.GetSendQAInfo()
  message.success('已刷新')
}

watch(selectedTabItem, (tab) => {
  if (tab === '1' && useQB.sendQuestions.length === 0) void useQB.GetSendQAInfo()
})

onMounted(async () => {
  await useQB.GetTags()
  await useQB.GetRecieveQAInfo()
  if (selectedTabItem.value === '1') {
    await useQB.GetSendQAInfo()
  }
})
</script>

<template>
  <div class="question-box-manage w-full min-w-0">
    <div
      v-if="accountInfo"
      class="space-y-4 w-full"
    >
      <ManagePageHeader
        title="提问箱管理"
        subtitle="收集观众提问并互动回复，支持话题标签分类、公开展示与 OBS 弹幕投屏"
        :function-type="FunctionTypes.QuestionBox"
        :loading="useQB.isLoading || useQB.isLoadingSend"
        :links="[{ label: '我的提问链接', value: directShareUrl }]"
      >
        <template #action>
          <div class="flex items-center gap-1.5 flex-wrap">
            <Button
              size="icon-sm"
              variant="outline"
              :loading="useQB.isLoading || useQB.isLoadingSend"
              aria-label="刷新"
              @click="refresh"
            >
              <RefreshCw class="size-3.5" />
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="分享提问箱"
                    @click="shareModalVisible = true"
                  >
                    <Share2 class="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>分享提问箱</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="outline"
              @click="showOBSModal = true"
            >
              OBS 组件
            </Button>

            <Button
              variant="default"
              class="gap-1.5"
              @click="router.push({ name: 'user-questionBox', params: { id: accountInfo.name } })"
            >
              <ExternalLink class="size-3.5" />
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
              <SelectItem value="__none__">不附加话题</SelectItem>
              <SelectItem
                v-for="tag in useQB.tags.filter((t) => t.visiable)"
                :key="tag.name"
                :value="tag.name"
              >
                #{{ tag.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </template>
      </ManagePageHeader>

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
              {{ useQB.sendThreads.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="2"
            class="gap-1"
          >
            <Trash2 class="size-3.5" />
            垃圾站
            <Badge
              v-if="useQB.trashQuestions.length > 0"
              variant="warning"
              size="xs"
            >
              {{ useQB.trashQuestions.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="3">设置</TabsTrigger>
        </TabsList>

        <TabsContent
          value="0"
          class="mt-3"
        >
          <QuestionBoxReceivedTab
            @reply="onOpenReply"
            @export-card="onOpenExportCard"
          />
        </TabsContent>

        <TabsContent
          value="1"
          class="mt-3"
        >
          <QuestionBoxSentTab />
        </TabsContent>

        <TabsContent
          value="2"
          class="mt-3 space-y-3"
        >
          <div
            v-if="useQB.isLoading && useQB.recieveQuestions.length === 0"
            class="space-y-3"
          >
            <Skeleton
              v-for="n in 3"
              :key="n"
              class="h-24 w-full rounded-lg"
            />
          </div>

          <Empty
            v-else-if="useQB.trashQuestions.length === 0"
            description="暂无被过滤的提问"
            class="py-12 border border-dashed rounded-lg"
          />

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
                <div class="flex items-center gap-2 flex-wrap">
                  <Button
                    size="xs"
                    variant="outline"
                    class="gap-1 text-emerald-600 dark:text-emerald-400"
                    @click="useQB.markAsNormal(item)"
                  >
                    <CheckCircle2 class="size-3.5" />
                    标记为正常
                  </Button>

                  <Popconfirm
                    v-if="canBlacklistQuestion(item)"
                    title="确认拉黑？"
                    :description="item.isAnonymous ? '确认拉黑该匿名提问来源并删除本条？' : `确认拉黑 ${item.sender?.name} 并删除本条？`"
                    @confirm="useQB.blacklist(item)"
                  >
                    <Button
                      size="xs"
                      variant="outline"
                      class="gap-1 text-amber-600 dark:text-amber-400"
                    >
                      <Ban class="size-3.5" />
                      {{ item.isAnonymous ? '拉黑来源' : '拉黑提问者' }}
                    </Button>
                  </Popconfirm>

                  <Popconfirm
                    title="确认彻底删除？"
                    description="删除后不可恢复，确定继续？"
                    @confirm="useQB.DelQA(item.id)"
                  >
                    <Button
                      size="xs"
                      variant="outline"
                      class="gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 class="size-3.5" />
                      彻底删除
                    </Button>
                  </Popconfirm>
                </div>
              </template>
            </QuestionItem>
          </div>
        </TabsContent>

        <TabsContent
          value="3"
          class="mt-3"
        >
          <QuestionBoxSettings />
        </TabsContent>
      </Tabs>
    </div>

    <QuestionBoxReplyModal v-model:show="replyModalVisible" />
    <QuestionBoxShareModal v-model:show="shareModalVisible" />
    <QuestionBoxOBSModal v-model:show="showOBSModal" />
    <QuestionExportCardModal
      v-model:show="exportCardVisible"
      :question="exportCardQuestion"
    />
  </div>
</template>
