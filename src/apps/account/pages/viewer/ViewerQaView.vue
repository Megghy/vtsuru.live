<script setup lang="ts">
import { MessageCircle, RefreshCw, Search } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import QuestionBoxFollowUpComposer from '@/apps/manage/components/question-box/QuestionBoxFollowUpComposer.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { useQuestionBox } from '@/store/useQuestionBox'

const router = useRouter()
const useQB = useQuestionBox()

const keyword = ref('')
const replyFilter = ref<'all' | 'replied' | 'pending'>('all')
const composingId = ref<number>()

const totalCount = computed(() => useQB.sendThreads.length)
const repliedCount = computed(
  () => useQB.sendThreads.filter((t) => Boolean(t.root.answer) || t.followUps.some((f) => Boolean(f.answer))).length,
)
const pendingCount = computed(() => totalCount.value - repliedCount.value)

const filteredThreads = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return useQB.sendThreads.filter((thread) => {
    const hasReply = Boolean(thread.root.answer) || thread.followUps.some((f) => Boolean(f.answer))
    if (replyFilter.value === 'replied' && !hasReply) return false
    if (replyFilter.value === 'pending' && hasReply) return false
    if (!kw) return true
    const targetMatch = thread.root.target?.name?.toLowerCase().includes(kw)
    const contentMatch = [thread.root, ...thread.followUps].some(
      (item) =>
        item.question?.message?.toLowerCase().includes(kw) ||
        item.answer?.message?.toLowerCase().includes(kw) ||
        item.tag?.toLowerCase().includes(kw),
    )
    return Boolean(targetMatch || contentMatch)
  })
})

async function refresh() {
  await useQB.GetSendQAInfo()
}

async function onSent() {
  composingId.value = undefined
  await useQB.GetSendQAInfo()
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return '-'
  const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp
  const diffSec = Math.floor((Date.now() - ts) / 1000)
  if (diffSec < 60) return '刚刚'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`
  return `${Math.floor(diffSec / 86400)} 天前`
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <AccountPageHeader
      title="我的棉花糖"
      subtitle="查看发给各主播的提问、主播回复与可追问记录（匿名提问仅对你本人可见）。"
    >
      <template #actions>
        <Button
          variant="outline"
          :disabled="useQB.isLoadingSend"
          class="gap-1.5"
          @click="refresh"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': useQB.isLoadingSend }"
          />
          刷新
        </Button>
      </template>
    </AccountPageHeader>

    <div class="grid grid-cols-3 gap-2.5">
      <Card class="p-3">
        <div class="text-xs text-muted-foreground">全部提问</div>
        <div class="text-lg font-bold font-mono tabular-nums mt-0.5">{{ totalCount }}</div>
      </Card>
      <Card class="p-3">
        <div class="text-xs text-muted-foreground">已获回复</div>
        <div class="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
          {{ repliedCount }}
        </div>
      </Card>
      <Card class="p-3">
        <div class="text-xs text-muted-foreground">等待回复</div>
        <div class="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
          {{ pendingCount }}
        </div>
      </Card>
    </div>

    <Card class="p-3 flex flex-col sm:flex-row gap-2.5">
      <div class="relative flex-1 min-w-0">
        <Search class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          v-model="keyword"
          placeholder="搜索主播名称、提问内容或回复..."
          class="pl-8"
        />
      </div>
      <div class="w-full sm:w-40 shrink-0">
        <Select v-model="replyFilter">
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="replied">已回复</SelectItem>
            <SelectItem value="pending">待回复</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Card>

    <div
      v-if="useQB.isLoadingSend && useQB.sendThreads.length === 0"
      class="space-y-3"
    >
      <Skeleton
        v-for="n in 3"
        :key="n"
        class="h-28 w-full rounded-lg"
      />
    </div>

    <Empty
      v-else-if="filteredThreads.length === 0"
      :description="useQB.sendThreads.length === 0 ? '还没有发出过棉花糖' : '没有符合筛选条件的棉花糖'"
      class="py-12 rounded-lg border border-dashed border-border"
    />

    <div
      v-else
      class="space-y-3"
    >
      <Card
        v-for="thread in filteredThreads"
        :key="thread.root.id"
        class="hover:border-primary/30 transition-colors"
      >
        <CardHeader class="p-3.5 pb-2">
          <div class="flex-between gap-2 flex-wrap text-xs">
            <div class="flex items-center gap-1.5 flex-wrap min-w-0">
              <Badge
                variant="outline"
                size="xs"
              >
                发给
              </Badge>
              <Button
                variant="link"
                class="h-auto p-0 font-semibold text-primary"
                @click="router.push({ name: 'user-questionBox', params: { id: thread.root.target.name || thread.root.target.id } })"
              >
                {{ thread.root.target.name }}
              </Button>
              <Badge
                v-if="thread.root.isAnonymous"
                variant="secondary"
                size="xs"
              >
                匿名发送
              </Badge>
              <Badge
                v-if="thread.root.tag"
                variant="secondary"
                size="xs"
              >
                #{{ thread.root.tag }}
              </Badge>
              <Badge
                :variant="thread.root.answer ? 'success' : 'outline'"
                size="xs"
              >
                {{ thread.root.answer ? '已回复' : '待回复' }}
              </Badge>
            </div>

            <span class="text-muted-foreground font-mono tabular-nums shrink-0">
              {{ formatRelativeTime(thread.root.sendAt) }}
            </span>
          </div>
        </CardHeader>

        <CardContent class="p-3.5 pt-2 space-y-3">
          <div
            v-for="(entry, index) in [thread.root, ...thread.followUps]"
            :key="entry.id"
            class="space-y-2"
            :class="{ 'pt-3 border-t border-border/60': index > 0 }"
          >
            <div
              v-if="index > 0"
              class="flex-between text-[11px] text-muted-foreground"
            >
              <span class="font-medium">追问 {{ index }}</span>
              <span class="font-mono tabular-nums">{{ formatRelativeTime(entry.sendAt) }}</span>
            </div>

            <p class="text-sm text-foreground leading-relaxed m-0 whitespace-pre-wrap break-words">
              {{ entry.question?.message }}
            </p>

            <div
              v-if="entry.questionImages && entry.questionImages.length > 0"
              class="flex items-center gap-2 flex-wrap"
            >
              <ImagePreview
                v-for="(img, imgIdx) in entry.questionImages"
                :key="img.id || imgIdx"
                :src="img.path || ''"
                :alt="img.name || '提问附图'"
                :gallery="entry.questionImages"
                :index="imgIdx"
                class="h-16 w-20"
              />
            </div>

            <div
              v-if="entry.answer"
              class="p-3 rounded-md bg-muted/40 border border-border/60 space-y-1.5"
            >
              <div class="flex-between text-xs text-muted-foreground">
                <span class="font-medium flex items-center gap-1">
                  <MessageCircle class="size-3.5 text-primary" />
                  主播回复
                  <span
                    v-if="entry.isEdited"
                    class="text-[11px] text-muted-foreground/80 font-normal"
                  >
                    (已编辑)
                  </span>
                </span>
                <span
                  v-if="entry.answer.createdAt"
                  class="font-mono text-[11px] tabular-nums"
                >
                  {{ formatRelativeTime(entry.answer.createdAt) }}
                </span>
              </div>
              <p class="text-xs text-foreground leading-relaxed m-0 whitespace-pre-wrap break-words">
                {{ entry.answer.message }}
              </p>
              <div
                v-if="entry.answerImages && entry.answerImages.length > 0"
                class="flex items-center gap-2 flex-wrap pt-1"
              >
                <ImagePreview
                  v-for="(img, imgIdx) in entry.answerImages"
                  :key="img.id || imgIdx"
                  :src="img.path || ''"
                  :alt="img.name || '回复附图'"
                  :gallery="entry.answerImages"
                  :index="imgIdx"
                  class="h-16 w-20"
                />
              </div>
            </div>
          </div>

          <template v-if="thread.root.canFollowUp">
            <QuestionBoxFollowUpComposer
              v-if="composingId === thread.root.id"
              :root="thread.root"
              class="pt-3 border-t border-border/60"
              @sent="onSent"
            />
            <Button
              v-else
              variant="outline"
              size="xs"
              @click="composingId = thread.root.id"
            >
              继续追问
            </Button>
          </template>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
