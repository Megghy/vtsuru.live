<script setup lang="ts">
import {
  Checkmark24Regular,
  Delete24Filled,
  Dismiss24Regular,
  Eye24Regular,
  EyeOff24Regular,
  MailUnread24Regular,
  Tv20Regular,
} from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { QAInfo } from '@/api/api-models'
import QuestionItems from '@/components/QuestionItems.vue'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import type { SortMode } from '@/store/useQuestionBox'
import { useQuestionBox } from '@/store/useQuestionBox'

const emit = defineEmits<{ (e: 'reply', item: QAInfo): void }>()
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
    useQB.onlyUnreplied,
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
  ],
  () => {
    pn.value = 1
  },
)

const sortOptions = [
  { label: '默认排序', value: 'default' },
  { label: '最新优先', value: 'newest' },
  { label: '最早优先', value: 'oldest' },
  { label: '未读优先', value: 'unreadFirst' },
  { label: '已回复优先', value: 'repliedFirst' },
  { label: '未回复优先', value: 'unrepliedFirst' },
] satisfies { label: string; value: SortMode }[]
</script>

<template>
  <div class="relative min-h-[200px]">
    <!-- 筛选工具栏 -->
    <div class="flex items-center justify-between gap-3 flex-wrap mb-3 text-xs">
      <div class="flex items-center gap-3">
        <Button variant="outline" @click="router.push({ name: 'question-display' })">
          打开展示展板
        </Button>
        <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none">
          <Checkbox
            :checked="isAllSelected"
            @update:checked="toggleSelectAll"
          />
          <span>本页全选</span>
        </label>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Input v-model="useQB.searchKeyword" placeholder="搜索内容..." class="w-36" />

        <Select
          :model-value="useQB.displayTag ?? 'all'"
          @update:model-value="useQB.displayTag = $event === 'all' ? null : String($event)"
        >
          <SelectTrigger class="w-28">
            <SelectValue placeholder="全部话题" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" class="text-xs">全部话题</SelectItem>
            <SelectItem
              v-for="t in useQB.tags"
              :key="t.name"
              :value="t.name"
              class="text-xs"
            >
              #{{ t.name }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          :model-value="useQB.sortMode"
          @update:model-value="useQB.sortMode = $event as SortMode"
        >
          <SelectTrigger class="w-28">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in sortOptions"
              :key="opt.value"
              :value="opt.value"
              class="text-xs"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <label class="flex items-center gap-1 cursor-pointer text-xs select-none">
          <Checkbox v-model:checked="useQB.onlyUnreplied" />
          <span>未回复</span>
        </label>
        <label class="flex items-center gap-1 cursor-pointer text-xs select-none">
          <Checkbox v-model:checked="useQB.onlyUnread" />
          <span>未读</span>
        </label>
        <label class="flex items-center gap-1 cursor-pointer text-xs select-none">
          <Checkbox v-model:checked="useQB.onlyFavorite" />
          <span>收藏</span>
        </label>
        <label class="flex items-center gap-1 cursor-pointer text-xs select-none">
          <Checkbox v-model:checked="useQB.onlyPublic" />
          <span>公开</span>
        </label>

        <Button v-if="hasActiveFilters" variant="ghost" class="text-primary" @click="clearFilters">
          清除筛选
        </Button>
      </div>
    </div>

    <Separator class="my-3" />

    <Empty
      v-if="useQB.recieveQuestionsFiltered.length === 0"
      description="暂无符合条件的提问"
      class="py-12"
    />

    <div v-else class="space-y-3">
      <Pagination
        v-if="useQB.recieveQuestionsFiltered.length > ps"
        v-model:page="pn"
        v-model:page-size="ps"
        :total="useQB.recieveQuestionsFiltered.length"
        :show-size-picker="true"
        :page-sizes="[20, 50, 100]"
        class="mb-3"
      />

      <QuestionItems
        :questions="pagedQuestions"
        selectable
        :selected-ids="useQB.selectedIds"
        @select="useQB.toggleSelect"
      >
        <template #footer="{ item }">
          <div class="flex items-center gap-2 flex-wrap text-xs pt-1">
            <!-- OBS 投屏快捷切换 -->
            <Button v-if="useQB.displayQuestion?.id === item.id" size="xs" variant="outline" class="text-emerald-600 dark:text-emerald-400 gap-1 border-emerald-500/30" @click="useQB.clearCurrentQuestion">
              <Tv20Regular class="size-3.5" />
              取消展示
            </Button>
            <Button v-else size="xs" variant="outline" class="gap-1" @click="useQB.setCurrentQuestion(item)">
              <Tv20Regular class="size-3.5" />
              投到 OBS
            </Button>

            <Button size="xs" variant="outline" :class="item.isReaded ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'" @click="useQB.read(item, !item.isReaded)">
              {{ item.isReaded ? '设为未读' : '设为已读' }}
            </Button>

            <Button size="xs" variant="outline" class="gap-1" @click="useQB.favorite(item, !item.isFavorite)">
              <Heart v-if="item.isFavorite" class="size-3.5 text-rose-500" />
              <HeartOutline v-else class="size-3.5" />
              {{ item.isFavorite ? '取消收藏' : '收藏' }}
            </Button>

            <!-- 拉黑提问者（仅非匿名且有 ID 时可用，带二次确认） -->
            <Popconfirm
              v-if="!item.isAnonymous && item.sender?.id"
              title="确认拉黑？"
              :description="`确认拉黑 ${item.sender.name} 吗？该用户的所有提问将被清理。`"
              @confirm="useQB.blacklist(item)"
            >
              <Button size="xs" variant="outline" class="text-amber-600 dark:text-amber-400">
                拉黑提问者
              </Button>
            </Popconfirm>

            <TooltipProvider v-else>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button size="xs" variant="outline" disabled>
                    拉黑
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p class="text-xs">匿名提问无法拉黑账号</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Popconfirm
              title="确认删除？"
              description="确认删除这条提问？"
              @confirm="useQB.DelQA(item.id)"
            >
              <Button size="xs" variant="outline" class="text-destructive gap-1 hover:text-destructive">
                <Delete24Filled class="size-3.5" />
                删除
              </Button>
            </Popconfirm>
          </div>
        </template>

        <template #header-extra="{ item }">
          <div class="flex items-center gap-1.5">
            <Popconfirm
              v-if="!item.isPublic && item.senderAllowsPublic === false"
              title="提问者选择不公开"
              description="提问者选择不公开展示这条内容。确定仍要放到提问页公开列表吗？"
              @confirm="useQB.setPublic(item, true, { force: true })"
            >
              <Button size="xs" variant="outline" class="gap-1">
                <Eye24Regular class="size-3.5" />
                公开
              </Button>
            </Popconfirm>
            <Button v-else size="xs" variant="outline" class="gap-1" @click="useQB.setPublic(item, !item.isPublic)">
              <EyeOff24Regular v-if="item.isPublic" class="size-3.5" />
              <Eye24Regular v-else class="size-3.5" />
              {{ item.isPublic ? '取消公开' : '公开' }}
            </Button>
            <Button size="xs" :variant="item.answer ? 'default' : 'secondary'" @click="emit('reply', item)">
              {{ item.answer ? '修改回复' : '回复' }}
            </Button>
          </div>
        </template>
      </QuestionItems>

      <Separator v-if="useQB.recieveQuestionsFiltered.length > ps" class="my-3" />

      <Pagination
        v-if="useQB.recieveQuestionsFiltered.length > ps"
        v-model:page="pn"
        v-model:page-size="ps"
        :total="useQB.recieveQuestionsFiltered.length"
        :show-size-picker="true"
        :page-sizes="[20, 50, 100]"
        class="mb-6"
      />
    </div>

    <!-- 底部浮动批量操作栏 -->
    <Transition name="fade">
      <div
        v-if="useQB.selectedIds.length > 0"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center bg-card border border-border rounded-full shadow-lg px-4 py-2 gap-2 text-xs"
      >
        <span class="font-medium text-foreground whitespace-nowrap">已选 {{ useQB.selectedIds.length }} 项</span>
        <div class="h-4 w-px bg-border mx-1" />

        <Button size="xs" variant="outline" class="gap-1" @click="useQB.batchRead(true)">
          <Checkmark24Regular class="size-3.5" />
          批量已读
        </Button>
        <Button size="xs" variant="outline" class="gap-1" @click="useQB.batchRead(false)">
          <MailUnread24Regular class="size-3.5" />
          批量未读
        </Button>
        <Button size="xs" variant="outline" class="gap-1" @click="useQB.batchSetPublic(true)">
          <Eye24Regular class="size-3.5" />
          批量公开
        </Button>
        <Button size="xs" variant="outline" class="gap-1" @click="useQB.batchSetPublic(false)">
          <EyeOff24Regular class="size-3.5" />
          批量私密
        </Button>
        <Button size="xs" variant="outline" class="gap-1" @click="useQB.batchFavorite(true)">
          <Heart class="size-3.5 text-rose-500" />
          批量收藏
        </Button>

        <Popconfirm
          title="确认批量删除？"
          :description="`确认批量删除已选中的 ${useQB.selectedIds.length} 条提问？`"
          @confirm="useQB.batchDelete"
        >
          <Button size="xs" variant="destructive" class="gap-1">
            <Delete24Filled class="size-3.5" />
            批量删除
          </Button>
        </Popconfirm>

        <div class="h-4 w-px bg-border mx-1" />

        <Button size="icon" variant="ghost" class="size-6 rounded-full" aria-label="取消选择" @click="useQB.clearSelection">
          <Dismiss24Regular class="size-3.5" />
        </Button>
      </div>
    </Transition>
  </div>
</template>
