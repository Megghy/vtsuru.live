<script setup lang="ts">
import { Delete24Filled } from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import {
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NPagination,
  NPopconfirm,
  NSelect,
  NText,
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
    useQB.onlyUnread,
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
}

watch(
  () => [useQB.searchKeyword, useQB.displayTag, useQB.sortMode, useQB.onlyFavorite, useQB.onlyPublic, useQB.onlyUnread],
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
        打开展示页
      </NButton>
      <NCheckbox
        :checked="isAllSelected"
        @update:checked="toggleSelectAll"
      >
        全选
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
      <NCheckbox v-model:checked="useQB.onlyFavorite"> 收藏 </NCheckbox>
      <NCheckbox v-model:checked="useQB.onlyPublic"> 公开 </NCheckbox>
      <NCheckbox v-model:checked="useQB.onlyUnread"> 未读 </NCheckbox>
      <NButton
        v-if="hasActiveFilters"
        text
        size="small"
        @click="clearFilters"
      >
        清除筛选
      </NButton>
    </NFlex>
  </NFlex>

  <NDivider style="margin: 10px 0" />

  <NEmpty
    v-if="useQB.recieveQuestionsFiltered.length === 0"
    description="暂无收到的提问"
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
      style="margin-bottom: 10px"
    />

    <QuestionItems
      :questions="pagedQuestions"
      selectable
      :selected-ids="useQB.selectedIds"
      @select="useQB.toggleSelect"
    >
      <template #footer="{ item }">
        <NFlex class="question-actions">
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
          <NButton
            size="small"
            type="warning"
            ghost
            @click="useQB.blacklist(item)"
          >
            拉黑提问者
          </NButton>
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
          {{ item.answer ? '查看/修改回复' : '回复' }}
        </NButton>
      </template>
    </QuestionItems>

    <NDivider
      v-if="useQB.recieveQuestionsFiltered.length > ps"
      style="margin: 10px 0"
    />
    <NPagination
      v-if="useQB.recieveQuestionsFiltered.length > ps"
      v-model:page="pn"
      v-model:page-size="ps"
      :item-count="useQB.recieveQuestionsFiltered.length"
      show-quick-jumper
      show-size-picker
      :page-sizes="[20, 50, 100]"
    />
  </div>

  <!-- 批量操作浮动栏 -->
  <Transition name="slide-up">
    <NCard
      v-if="useQB.selectedIds.length > 0"
      class="batch-bar"
      size="small"
    >
      <NFlex
        align="center"
        justify="space-between"
      >
        <NText>已选择 {{ useQB.selectedIds.length }} 项</NText>
        <NFlex :size="8">
          <NButton
            size="small"
            @click="useQB.batchRead(true)"
          >
            标记已读
          </NButton>
          <NButton
            size="small"
            @click="useQB.batchRead(false)"
          >
            标记未读
          </NButton>
          <NButton
            size="small"
            @click="useQB.batchSetPublic(true)"
          >
            设为公开
          </NButton>
          <NButton
            size="small"
            @click="useQB.batchSetPublic(false)"
          >
            设为私密
          </NButton>
          <NButton
            size="small"
            @click="useQB.batchFavorite(true)"
          >
            收藏
          </NButton>
          <NButton
            size="small"
            @click="useQB.batchFavorite(false)"
          >
            取消收藏
          </NButton>
          <NPopconfirm @positive-click="useQB.batchDelete()">
            <template #trigger>
              <NButton
                size="small"
                type="error"
              >
                批量删除
              </NButton>
            </template>
            确认删除选中的 {{ useQB.selectedIds.length }} 条提问？
          </NPopconfirm>
          <NButton
            size="small"
            quaternary
            @click="useQB.clearSelection()"
          >
            取消
          </NButton>
        </NFlex>
      </NFlex>
    </NCard>
  </Transition>
</template>

<style scoped>
.received-toolbar {
  margin-bottom: 12px;
}

.question-actions {
  flex-wrap: wrap;
}

.batch-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  width: auto;
  max-width: 90vw;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

@media (max-width: 640px) {
  .received-toolbar {
    align-items: stretch;
  }

  .received-toolbar > :deep(.n-flex) {
    width: 100%;
  }

  .received-toolbar :deep(.n-input),
  .received-toolbar :deep(.n-base-selection) {
    flex: 1 1 140px;
    width: auto !important;
  }

  .batch-bar {
    bottom: 12px;
    max-width: calc(100vw - 24px);
  }

  .batch-bar > :deep(.n-card__content) {
    padding: 10px;
  }

  .batch-bar > :deep(.n-card__content > .n-flex) {
    align-items: stretch;
    flex-direction: column;
  }

  .batch-bar > :deep(.n-card__content > .n-flex > .n-flex) {
    flex-wrap: wrap;
  }
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateX(-50%) translateY(20px);
  opacity: 0;
}
</style>
