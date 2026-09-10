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
import {
  NButton,
  NCheckbox,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NPagination,
  NPopconfirm,
  NSelect,
  NTooltip,
  useThemeVars,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { QAInfo } from '@/api/api-models'
import QuestionItems from '@/components/QuestionItems.vue'
import type { SortMode } from '@/store/useQuestionBox'
import { useQuestionBox } from '@/store/useQuestionBox'

const emit = defineEmits<{ (e: 'reply', item: QAInfo): void }>()
const useQB = useQuestionBox()
const router = useRouter()
const themeVars = useThemeVars()

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
  <div class="received-tab-root">
    <!-- 筛选栏 -->
    <NFlex
      class="received-toolbar"
      align="center"
      justify="space-between"
      wrap
      :size="8"
      style="margin-bottom: 12px"
    >
      <NFlex
        :size="8"
        align="center"
      >
        <NButton
          secondary
          type="primary"
          size="small"
          @click="router.push({ name: 'question-display' })"
        >
          打开展示展板
        </NButton>
        <NCheckbox
          :checked="isAllSelected"
          @update:checked="toggleSelectAll"
        >
          本页全选
        </NCheckbox>
      </NFlex>

      <NFlex
        :size="8"
        align="center"
        wrap
      >
        <NInput
          v-model:value="useQB.searchKeyword"
          placeholder="搜索内容..."
          clearable
          size="small"
          style="width: 160px"
        />
        <NSelect
          v-model:value="useQB.displayTag"
          placeholder="话题"
          clearable
          filterable
          size="small"
          :options="useQB.tags.map((s) => ({ label: s.name, value: s.name }))"
          style="width: 120px"
        />
        <NSelect
          v-model:value="useQB.sortMode"
          size="small"
          :options="sortOptions"
          style="width: 130px"
        />
        <NCheckbox v-model:checked="useQB.onlyUnreplied"> 未回复 </NCheckbox>
        <NCheckbox v-model:checked="useQB.onlyUnread"> 未读 </NCheckbox>
        <NCheckbox v-model:checked="useQB.onlyFavorite"> 收藏 </NCheckbox>
        <NCheckbox v-model:checked="useQB.onlyPublic"> 公开 </NCheckbox>
        <NButton
          v-if="hasActiveFilters"
          text
          size="small"
          type="primary"
          @click="clearFilters"
        >
          清除筛选
        </NButton>
      </NFlex>
    </NFlex>

    <NDivider style="margin: 10px 0" />

    <NEmpty
      v-if="useQB.recieveQuestionsFiltered.length === 0"
      description="暂无符合条件的提问"
      style="padding: 40px 0"
    />

    <div v-else>
      <NPagination
        v-if="useQB.recieveQuestionsFiltered.length > ps"
        v-model:page="pn"
        v-model:page-size="ps"
        :item-count="useQB.recieveQuestionsFiltered.length"
        show-quick-jumper
        show-size-picker
        :page-sizes="[20, 50, 100]"
        style="margin-bottom: 12px"
      />

      <QuestionItems
        :questions="pagedQuestions"
        selectable
        :selected-ids="useQB.selectedIds"
        @select="useQB.toggleSelect"
      >
        <template #footer="{ item }">
          <NFlex
            class="question-actions"
            align="center"
            wrap
            :size="8"
          >
            <!-- OBS 投屏快捷切换 -->
            <NButton
              v-if="useQB.displayQuestion?.id === item.id"
              size="small"
              type="success"
              secondary
              @click="useQB.clearCurrentQuestion"
            >
              <template #icon><NIcon :component="Tv20Regular" /></template>
              取消展示
            </NButton>
            <NButton
              v-else
              size="small"
              secondary
              @click="useQB.setCurrentQuestion(item)"
            >
              <template #icon><NIcon :component="Tv20Regular" /></template>
              投到 OBS
            </NButton>

            <NButton
              size="small"
              :type="item.isReaded ? 'warning' : 'info'"
              ghost
              @click="useQB.read(item, !item.isReaded)"
            >
              {{ item.isReaded ? '设为未读' : '设为已读' }}
            </NButton>

            <NButton
              size="small"
              ghost
              @click="useQB.favorite(item, !item.isFavorite)"
            >
              <template #icon>
                <NIcon
                  :component="item.isFavorite ? Heart : HeartOutline"
                  :color="item.isFavorite ? themeVars.errorColor : undefined"
                />
              </template>
              {{ item.isFavorite ? '取消收藏' : '收藏' }}
            </NButton>

            <!-- 拉黑提问者（仅非匿名且有 ID 时可用，带二次确认） -->
            <NPopconfirm
              v-if="!item.isAnonymous && item.sender?.id"
              @positive-click="useQB.blacklist(item)"
            >
              <template #trigger>
                <NButton
                  size="small"
                  type="warning"
                  ghost
                >
                  拉黑提问者
                </NButton>
              </template>
              确认拉黑 {{ item.sender.name }} 吗？该用户的所有提问将被清理。
            </NPopconfirm>

            <NTooltip v-else>
              <template #trigger>
                <NButton
                  size="small"
                  disabled
                  ghost
                >
                  拉黑
                </NButton>
              </template>
              匿名提问无法拉黑账号
            </NTooltip>

            <NPopconfirm @positive-click="useQB.DelQA(item.id)">
              <template #trigger>
                <NButton
                  size="small"
                  type="error"
                  ghost
                >
                  <template #icon>
                    <NIcon :component="Delete24Filled" />
                  </template>
                  删除
                </NButton>
              </template>
              确认删除这条提问？
            </NPopconfirm>
          </NFlex>
        </template>

        <template #header-extra="{ item }">
          <NButton
            :type="item.answer ? 'primary' : 'info'"
            :tertiary="item.isReaded && !item.answer"
            :secondary="!item.isReaded && !item.answer"
            @click="emit('reply', item)"
          >
            {{ item.answer ? '修改回复' : '回复' }}
          </NButton>
        </template>
      </QuestionItems>

      <NDivider
        v-if="useQB.recieveQuestionsFiltered.length > ps"
        style="margin: 16px 0"
      />

      <NPagination
        v-if="useQB.recieveQuestionsFiltered.length > ps"
        v-model:page="pn"
        v-model:page-size="ps"
        :item-count="useQB.recieveQuestionsFiltered.length"
        show-quick-jumper
        show-size-picker
        :page-sizes="[20, 50, 100]"
        style="margin-bottom: 24px"
      />
    </div>

    <!-- 底部浮动批量操作栏 -->
    <Transition name="batch-bar-slide">
      <div
        v-if="useQB.selectedIds.length > 0"
        class="floating-batch-bar"
      >
        <div class="batch-bar-content">
          <span class="batch-bar-count"> 已选 {{ useQB.selectedIds.length }} 项 </span>

          <span class="batch-bar-divider" />

          <NButton
            size="small"
            secondary
            @click="useQB.batchRead(true)"
          >
            <template #icon><NIcon :component="Checkmark24Regular" /></template>
            批量已读
          </NButton>

          <NButton
            size="small"
            secondary
            @click="useQB.batchRead(false)"
          >
            <template #icon><NIcon :component="MailUnread24Regular" /></template>
            批量未读
          </NButton>

          <NButton
            size="small"
            secondary
            @click="useQB.batchSetPublic(true)"
          >
            <template #icon><NIcon :component="Eye24Regular" /></template>
            批量公开
          </NButton>

          <NButton
            size="small"
            secondary
            @click="useQB.batchSetPublic(false)"
          >
            <template #icon><NIcon :component="EyeOff24Regular" /></template>
            批量私密
          </NButton>

          <NButton
            size="small"
            secondary
            @click="useQB.batchFavorite(true)"
          >
            <template #icon><NIcon :component="Heart" /></template>
            批量收藏
          </NButton>

          <NPopconfirm @positive-click="useQB.batchDelete">
            <template #trigger>
              <NButton
                size="small"
                type="error"
                secondary
              >
                <template #icon><NIcon :component="Delete24Filled" /></template>
                批量删除
              </NButton>
            </template>
            确认批量删除已选中的 {{ useQB.selectedIds.length }} 条提问？
          </NPopconfirm>

          <span class="batch-bar-divider" />

          <NButton
            size="small"
            quaternary
            circle
            aria-label="取消选择"
            @click="useQB.clearSelection"
          >
            <template #icon><NIcon :component="Dismiss24Regular" /></template>
          </NButton>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.received-tab-root {
  position: relative;
  min-height: 200px;
}

.floating-batch-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  display: flex;
  align-items: center;
}

.batch-bar-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 30px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 22%);
  backdrop-filter: blur(12px);
}

.batch-bar-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  padding: 0 4px;
}

.batch-bar-divider {
  width: 1px;
  height: 18px;
  margin: 0 2px;
  background: var(--vtsuru-border);
}

.batch-bar-slide-enter-active,
.batch-bar-slide-leave-active {
  transition:
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.batch-bar-slide-enter-from,
.batch-bar-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>
