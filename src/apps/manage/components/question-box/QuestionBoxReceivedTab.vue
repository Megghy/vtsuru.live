<script setup lang="ts">
import {
  Ban,
  Check,
  Download,
  Eye,
  EyeOff,
  Heart,
  Image as ImageIcon,
  MailOpen,
  MailWarning,
  MoreHorizontal,
  Pin,
  PinOff,
  ShieldAlert,
  Tag,
  Trash2,
  Tv,
  X,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { ResponseQAInfoToTarget } from '@/api/generated/model'
import QuestionItems from '@/components/QuestionItems.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Skeleton } from '@/shared/ui/skeleton'
import type { SortMode } from '@/store/useQuestionBox'
import { useQuestionBox } from '@/store/useQuestionBox'

const emit = defineEmits<{
  (e: 'reply', item: ResponseQAInfoToTarget): void
  (e: 'exportCard', item: ResponseQAInfoToTarget): void
}>()

const useQB = useQuestionBox()
const router = useRouter()

const ps = ref(20)
const pn = ref(1)

const pagedQuestions = computed(() =>
  useQB.recieveQuestionsFiltered.slice((pn.value - 1) * ps.value, pn.value * ps.value),
)

const hasActiveFilters = computed(
  () =>
    Boolean(useQB.searchKeyword) ||
    Boolean(useQB.displayTag) ||
    useQB.sortMode !== 'default' ||
    useQB.onlyFavorite ||
    useQB.onlyPublic ||
    useQB.onlyUnread ||
    useQB.onlyUnreplied ||
    useQB.onlyPinned,
)

const isAllSelected = computed(
  () => pagedQuestions.value.length > 0 && pagedQuestions.value.every((q) => useQB.selectedIds.includes(q.id)),
)

function toggleSelectAll(checked: boolean) {
  if (checked) useQB.selectAll(pagedQuestions.value.map((q) => q.id))
  else useQB.selectedIds = useQB.selectedIds.filter((id) => !pagedQuestions.value.some((q) => q.id === id))
}

function clearFilters() {
  useQB.searchKeyword = ''
  useQB.displayTag = null
  useQB.sortMode = 'default'
  useQB.onlyFavorite = false
  useQB.onlyPublic = false
  useQB.onlyUnread = false
  useQB.onlyUnreplied = false
  useQB.onlyPinned = false
}

function canBlacklistQuestion(item: ResponseQAInfoToTarget) {
  return (!item.isAnonymous && Boolean(item.sender?.id)) || Boolean(item.canBlacklistAnonymous)
}

watch(
  () => [
    useQB.searchKeyword,
    useQB.displayTag,
    useQB.sortMode,
    useQB.onlyFavorite,
    useQB.onlyPublic,
    useQB.onlyUnread,
    useQB.onlyUnreplied,
    useQB.onlyPinned,
  ],
  () => {
    pn.value = 1
  },
)

const sortOptions = [
  { label: '默认（置顶/未读）', value: 'default' },
  { label: '最新优先', value: 'newest' },
  { label: '最早优先', value: 'oldest' },
  { label: '未读优先', value: 'unreadFirst' },
  { label: '已回复优先', value: 'repliedFirst' },
  { label: '未回复优先', value: 'unrepliedFirst' },
] satisfies { label: string; value: SortMode }[]
</script>

<template>
  <div class="relative min-h-[240px] space-y-3">
    <!-- AI 审核队列状态提示 -->
    <Alert
      v-if="useQB.stats.reviewing > 0"
      variant="default"
      class="py-2 px-3"
    >
      <ShieldAlert class="size-4 text-amber-500" />
      <AlertDescription class="text-xs flex-between gap-2">
        <span>当前有 <strong class="tabular-nums">{{ useQB.stats.reviewing }}</strong> 条新提问正在进行 AI 内容安全审核，通过后将自动进入收件箱。</span>
        <Button
          size="xs"
          variant="outline"
          @click="useQB.GetRecieveQAInfo()"
        >
          刷新状态
        </Button>
      </AlertDescription>
    </Alert>

    <!-- 顶部快捷统计筛选胶囊 -->
    <div class="flex items-center gap-1.5 flex-wrap">
      <Button
        size="xs"
        :variant="!hasActiveFilters ? 'secondary' : 'outline'"
        class="gap-1.5 tabular-nums"
        @click="clearFilters"
      >
        全部
        <Badge
          variant="secondary"
          size="xs"
        >
          {{ useQB.stats.total }}
        </Badge>
      </Button>
      <Button
        size="xs"
        :variant="useQB.onlyUnread ? 'default' : 'outline'"
        class="gap-1.5 tabular-nums"
        @click="useQB.onlyUnread = !useQB.onlyUnread"
      >
        未读
        <Badge
          :variant="useQB.stats.unread > 0 ? 'warning' : 'secondary'"
          size="xs"
        >
          {{ useQB.stats.unread }}
        </Badge>
      </Button>
      <Button
        size="xs"
        :variant="useQB.onlyUnreplied ? 'default' : 'outline'"
        class="gap-1.5 tabular-nums"
        @click="useQB.onlyUnreplied = !useQB.onlyUnreplied"
      >
        未回复
        <Badge
          variant="secondary"
          size="xs"
        >
          {{ useQB.stats.unreplied }}
        </Badge>
      </Button>
      <Button
        size="xs"
        :variant="useQB.onlyPublic ? 'default' : 'outline'"
        class="gap-1.5 tabular-nums"
        @click="useQB.onlyPublic = !useQB.onlyPublic"
      >
        已公开
        <Badge
          variant="secondary"
          size="xs"
        >
          {{ useQB.stats.publicCount }}
        </Badge>
      </Button>
      <Button
        size="xs"
        :variant="useQB.onlyFavorite ? 'default' : 'outline'"
        class="gap-1.5 tabular-nums"
        @click="useQB.onlyFavorite = !useQB.onlyFavorite"
      >
        收藏
        <Badge
          variant="secondary"
          size="xs"
        >
          {{ useQB.stats.favoriteCount }}
        </Badge>
      </Button>
      <Button
        size="xs"
        :variant="useQB.onlyPinned ? 'default' : 'outline'"
        class="gap-1.5 tabular-nums"
        @click="useQB.onlyPinned = !useQB.onlyPinned"
      >
        置顶
        <Badge
          variant="secondary"
          size="xs"
        >
          {{ useQB.stats.pinnedCount }}
        </Badge>
      </Button>
    </div>

    <!-- 搜索、筛选与操作工具栏 -->
    <div class="flex-between gap-2 flex-wrap text-xs">
      <div class="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          class="gap-1.5"
          @click="router.push({ name: 'question-display' })"
        >
          <Tv class="size-3.5" />
          打开展示展板
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="outline"
              class="gap-1.5"
              :disabled="useQB.recieveQuestionsFiltered.length === 0"
            >
              <Download class="size-3.5" />
              导出{{ useQB.selectedIds.length ? ` (${useQB.selectedIds.length})` : '' }}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel class="text-[11px]">
              {{ useQB.selectedIds.length ? `导出已选 ${useQB.selectedIds.length} 条` : `导出当前筛选 ${useQB.recieveQuestionsFiltered.length} 条` }}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="useQB.exportQuestions('markdown')">Markdown (.md)</DropdownMenuItem>
            <DropdownMenuItem @click="useQB.exportQuestions('csv')">表格文件 (.csv)</DropdownMenuItem>
            <DropdownMenuItem @click="useQB.exportQuestions('json')">原始数据 (.json)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div class="flex items-center gap-1.5 pl-1">
          <Checkbox
            id="qa-select-all"
            :checked="isAllSelected"
            @update:checked="toggleSelectAll"
          />
          <label
            for="qa-select-all"
            class="cursor-pointer text-xs select-none text-muted-foreground"
          >
            本页全选
          </label>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Input
          v-model="useQB.searchKeyword"
          placeholder="搜索提问、回复或昵称..."
          class="w-44"
        />

        <Select
          :model-value="useQB.displayTag ?? 'all'"
          @update:model-value="useQB.displayTag = $event === 'all' ? null : String($event)"
        >
          <SelectTrigger class="w-28">
            <SelectValue placeholder="全部话题" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部话题</SelectItem>
            <SelectItem
              v-for="t in useQB.tags"
              :key="t.name"
              :value="t.name"
            >
              #{{ t.name }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          :model-value="useQB.sortMode"
          @update:model-value="useQB.sortMode = $event as SortMode"
        >
          <SelectTrigger class="w-36">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in sortOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          v-if="hasActiveFilters"
          variant="ghost"
          class="text-primary"
          @click="clearFilters"
        >
          重置
        </Button>
      </div>
    </div>

    <Separator />

    <!-- 加载骨架屏 -->
    <div
      v-if="useQB.isLoading && useQB.recieveQuestions.length === 0"
      class="space-y-3"
    >
      <div
        v-for="n in 4"
        :key="n"
        class="p-4 rounded-lg border border-border bg-card space-y-2.5"
      >
        <div class="flex-between">
          <Skeleton class="h-4 w-40" />
          <Skeleton class="h-6 w-24" />
        </div>
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-3/4" />
      </div>
    </div>

    <Empty
      v-else-if="useQB.recieveQuestionsFiltered.length === 0"
      description="暂无符合条件的提问"
      class="py-12 border border-dashed rounded-lg"
    />

    <div
      v-else
      class="space-y-3"
    >
      <Pagination
        v-if="useQB.recieveQuestionsFiltered.length > ps"
        v-model:page="pn"
        v-model:page-size="ps"
        :total="useQB.recieveQuestionsFiltered.length"
        :show-size-picker="true"
        :page-sizes="[20, 50, 100]"
      />

      <QuestionItems
        :questions="pagedQuestions"
        selectable
        :selected-ids="useQB.selectedIds"
        @select="useQB.toggleSelect"
      >
        <template #header-extra="{ item }">
          <div class="flex items-center gap-1.5">
            <Popconfirm
              v-if="!item.isPublic && item.senderAllowsPublic === false"
              title="提问者选择不公开"
              description="提问者选择不公开展示这条内容。确定仍要放到提问页公开列表吗？"
              @confirm="useQB.setPublic(item, true, { force: true })"
            >
              <Button
                size="xs"
                variant="outline"
                class="gap-1"
              >
                <Eye class="size-3.5" />
                公开
              </Button>
            </Popconfirm>
            <Button
              v-else
              size="xs"
              variant="outline"
              class="gap-1"
              @click="useQB.setPublic(item, !item.isPublic)"
            >
              <EyeOff
                v-if="item.isPublic"
                class="size-3.5"
              />
              <Eye
                v-else
                class="size-3.5"
              />
              {{ item.isPublic ? '取消公开' : '公开' }}
            </Button>

            <Button
              size="xs"
              :variant="item.answer ? 'default' : 'secondary'"
              @click="emit('reply', item)"
            >
              {{ item.answer ? '修改回复' : '回复' }}
            </Button>
          </div>
        </template>

        <template #footer="{ item }">
          <div class="flex-between gap-2 flex-wrap w-full text-xs">
            <div class="flex items-center gap-1.5 flex-wrap">
              <Button
                v-if="useQB.displayQuestion?.id === item.id"
                size="xs"
                variant="outline"
                class="text-emerald-600 dark:text-emerald-400 gap-1 border-emerald-500/30"
                @click="useQB.clearCurrentQuestion"
              >
                <Tv class="size-3.5" />
                取消展示
              </Button>
              <Button
                v-else
                size="xs"
                variant="outline"
                class="gap-1"
                @click="useQB.setCurrentQuestion(item)"
              >
                <Tv class="size-3.5" />
                投到 OBS
              </Button>

              <Button
                size="xs"
                variant="outline"
                class="gap-1"
                :class="item.isReaded ? 'text-muted-foreground' : 'text-brand'"
                @click="useQB.read(item, !item.isReaded)"
              >
                <MailOpen
                  v-if="!item.isReaded"
                  class="size-3.5"
                />
                <MailWarning
                  v-else
                  class="size-3.5"
                />
                {{ item.isReaded ? '设为未读' : '设为已读' }}
              </Button>

              <Button
                size="xs"
                variant="outline"
                class="gap-1"
                @click="useQB.favorite(item, !item.isFavorite)"
              >
                <Heart
                  class="size-3.5"
                  :class="item.isFavorite ? 'text-rose-500 fill-rose-500' : ''"
                />
                {{ item.isFavorite ? '已收藏' : '收藏' }}
              </Button>

              <Button
                size="xs"
                variant="outline"
                class="gap-1"
                :class="item.isPinned ? 'text-brand border-brand/40' : ''"
                @click="useQB.pin(item, !item.isPinned)"
              >
                <PinOff
                  v-if="item.isPinned"
                  class="size-3.5"
                />
                <Pin
                  v-else
                  class="size-3.5"
                />
                {{ item.isPinned ? '取消置顶' : '置顶' }}
              </Button>
            </div>

            <div class="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="更多操作"
                  >
                    <MoreHorizontal class="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  class="w-44"
                >
                  <DropdownMenuItem
                    class="gap-2"
                    @click="emit('exportCard', item)"
                  >
                    <ImageIcon class="size-3.5" />
                    生成问答分享图
                  </DropdownMenuItem>

                  <DropdownMenuSub v-if="useQB.tags.length > 0">
                    <DropdownMenuSubTrigger class="gap-2">
                      <Tag class="size-3.5" />
                      修改话题标签
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent class="max-h-60 overflow-y-auto scrollbar-thin">
                      <DropdownMenuItem
                        :disabled="!item.tag"
                        @click="useQB.updateQuestionTag(item, null)"
                      >
                        无话题
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        v-for="t in useQB.tags"
                        :key="t.name"
                        @click="useQB.updateQuestionTag(item, t.name)"
                      >
                        <Check
                          class="size-3.5 mr-1.5"
                          :class="item.tag === t.name ? 'opacity-100' : 'opacity-0'"
                        />
                        #{{ t.name }}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuItem
                    class="gap-2"
                    @click="useQB.approve(item, false)"
                  >
                    <ShieldAlert class="size-3.5" />
                    移入垃圾站
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    v-if="canBlacklistQuestion(item)"
                    class="gap-2 text-amber-600 dark:text-amber-400 focus:text-amber-600"
                    @click="useQB.blacklist(item)"
                  >
                    <Ban class="size-3.5" />
                    {{ item.isAnonymous ? '拉黑匿名来源并删除' : '拉黑提问者并删除' }}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    class="gap-2 text-destructive focus:text-destructive"
                    @click="useQB.DelQA(item.id)"
                  >
                    <Trash2 class="size-3.5" />
                    彻底删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </template>
      </QuestionItems>

      <Pagination
        v-if="useQB.recieveQuestionsFiltered.length > ps"
        v-model:page="pn"
        v-model:page-size="ps"
        :total="useQB.recieveQuestionsFiltered.length"
        :show-size-picker="true"
        :page-sizes="[20, 50, 100]"
        class="pb-4"
      />
    </div>

    <!-- 容器内 Sticky 响应式批量操作栏 -->
    <Transition name="fade">
      <div
        v-if="useQB.selectedIds.length > 0"
        class="sticky bottom-3 z-30 mx-auto w-fit max-w-full flex items-center flex-wrap justify-center bg-card/95 backdrop-blur border border-border rounded-xl shadow-lg px-3 py-2 gap-1.5 text-xs"
      >
        <span class="font-medium text-foreground whitespace-nowrap tabular-nums px-1">
          已选 {{ useQB.selectedIds.length }} 项
        </span>
        <Separator
          orientation="vertical"
          class="h-4 mx-0.5 hidden sm:block"
        />

        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          @click="useQB.batchRead(true)"
        >
          <Check class="size-3.5" />
          已读
        </Button>
        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          @click="useQB.batchRead(false)"
        >
          <MailWarning class="size-3.5" />
          未读
        </Button>
        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          @click="useQB.batchSetPublic(true)"
        >
          <Eye class="size-3.5" />
          公开
        </Button>
        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          @click="useQB.batchSetPublic(false)"
        >
          <EyeOff class="size-3.5" />
          私密
        </Button>
        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          @click="useQB.batchFavorite(true)"
        >
          <Heart class="size-3.5 text-rose-500" />
          收藏
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              size="xs"
              variant="outline"
              class="gap-1"
            >
              更多
              <MoreHorizontal class="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="useQB.batchFavorite(false)">批量取消收藏</DropdownMenuItem>
            <DropdownMenuItem @click="useQB.batchReject()">批量移入垃圾站</DropdownMenuItem>
            <DropdownMenuSub v-if="useQB.tags.length > 0">
              <DropdownMenuSubTrigger>批量修改话题</DropdownMenuSubTrigger>
              <DropdownMenuSubContent class="max-h-60 overflow-y-auto scrollbar-thin">
                <DropdownMenuItem @click="useQB.batchSetTag(null)">清除话题</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  v-for="t in useQB.tags"
                  :key="t.name"
                  @click="useQB.batchSetTag(t.name)"
                >
                  #{{ t.name }}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popconfirm
          title="确认批量删除？"
          :description="`确认批量删除已选中的 ${useQB.selectedIds.length} 条提问？`"
          @confirm="useQB.batchDelete"
        >
          <Button
            size="xs"
            variant="destructive"
            class="gap-1"
          >
            <Trash2 class="size-3.5" />
            删除
          </Button>
        </Popconfirm>

        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="取消选择"
          @click="useQB.clearSelection"
        >
          <X class="size-3.5" />
        </Button>
      </div>
    </Transition>
  </div>
</template>
