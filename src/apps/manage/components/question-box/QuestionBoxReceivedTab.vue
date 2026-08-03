<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { QAInfo } from '@/api/api-models'
import QuestionItems from '@/components/QuestionItems.vue'
import type { SortMode } from '@/store/useQuestionBox'
import { useQuestionBox } from '@/store/useQuestionBox'

const emit = defineEmits<{ reply: [item: QAInfo] }>()
const useQB = useQuestionBox()
const router = useRouter()
const pageSize = ref(20)
const page = ref(1)
const deleteTarget = ref<QAInfo | null>(null)
const deleteBatchOpen = ref(false)
const pageSizeOptions = [20, 50, 100].map((value) => ({ label: `${value} 条/页`, value }))

const pagedQuestions = computed(() => useQB.recieveQuestionsFiltered.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
const isAllSelected = computed(() => pagedQuestions.value.length > 0 && pagedQuestions.value.every((question) => useQB.selectedIds.includes(question.id)))
const sortOptions = [
  { label: '默认排序', value: 'default' }, { label: '最新优先', value: 'newest' }, { label: '最早优先', value: 'oldest' },
  { label: '未读优先', value: 'unreadFirst' }, { label: '已回复优先', value: 'repliedFirst' }, { label: '未回复优先', value: 'unrepliedFirst' },
] satisfies { label: string; value: SortMode }[]

function toggleSelectAll(checked: boolean) {
  if (checked) useQB.selectAll(pagedQuestions.value.map((question) => question.id))
  else useQB.selectedIds = useQB.selectedIds.filter((id) => !pagedQuestions.value.some((question) => question.id === id))
}

function deleteOne() { if (deleteTarget.value) useQB.DelQA(deleteTarget.value.id); deleteTarget.value = null }
function deleteSelected() { useQB.batchDelete(); deleteBatchOpen.value = false }
</script>

<template>
  <div class="received-tab">
    <div class="filter-bar">
      <div class="filter-bar__group">
        <UButton size="sm" label="打开展示页" @click="router.push({ name: 'question-display' })" />
        <UCheckbox :model-value="isAllSelected" label="全选" @update:model-value="toggleSelectAll" />
      </div>
      <div class="filter-bar__group">
        <UInput v-model="useQB.searchKeyword" placeholder="搜索内容..." size="sm" class="search-input" />
        <USelect v-model="useQB.displayTag" placeholder="话题" :items="useQB.tags.map((tag) => ({ label: tag.name, value: tag.name }))" size="sm" class="select-input" />
        <USelect v-model="useQB.sortMode" :items="sortOptions" size="sm" class="sort-input" />
        <UCheckbox v-model="useQB.onlyFavorite" label="收藏" /><UCheckbox v-model="useQB.onlyPublic" label="公开" /><UCheckbox v-model="useQB.onlyUnread" label="未读" />
      </div>
    </div>
    <USeparator />
    <UEmpty v-if="useQB.recieveQuestionsFiltered.length === 0" title="暂无收到的提问" />
    <template v-else>
      <div v-if="useQB.recieveQuestionsFiltered.length > pageSize" class="pagination"><USelect v-model="pageSize" :items="pageSizeOptions" size="sm" /><UPagination v-model:page="page" :total="useQB.recieveQuestionsFiltered.length" :items-per-page="pageSize" :show-edges="false" size="sm" /></div>
      <QuestionItems :questions="pagedQuestions" selectable :selected-ids="useQB.selectedIds" @select="useQB.toggleSelect">
        <template #footer="{ item }">
          <div class="item-actions">
            <UButton size="xs" :color="item.isReaded ? 'warning' : 'info'" variant="soft" :label="item.isReaded ? '设为未读' : '设为已读'" @click="useQB.read(item, !item.isReaded)" />
            <UButton size="xs" color="neutral" variant="soft" @click="useQB.favorite(item, !item.isFavorite)"><template #leading><UIcon :name="item.isFavorite ? 'i-lucide-heart-off' : 'i-lucide-heart'" /></template>{{ item.isFavorite ? '取消收藏' : '收藏' }}</UButton>
            <UButton size="xs" color="warning" variant="soft" label="拉黑提问者" @click="useQB.blacklist(item)" />
            <UButton size="xs" color="error" variant="soft" label="删除" @click="deleteTarget = item" />
          </div>
        </template>
        <template #header-extra="{ item }"><UButton size="sm" :color="item.answer ? 'primary' : 'info'" :variant="item.isReaded ? 'ghost' : 'soft'" :label="item.answer ? '查看/修改回复' : '回复'" @click="emit('reply', item)" /></template>
      </QuestionItems>
      <div v-if="useQB.recieveQuestionsFiltered.length > pageSize" class="pagination"><USelect v-model="pageSize" :items="pageSizeOptions" size="sm" /><UPagination v-model:page="page" :total="useQB.recieveQuestionsFiltered.length" :items-per-page="pageSize" :show-edges="false" size="sm" /></div>
    </template>
    <Transition name="slide-up"><UCard v-if="useQB.selectedIds.length" class="batch-bar" :ui="{ body: 'p-3' }"><div class="batch-bar__content"><span>已选择 {{ useQB.selectedIds.length }} 项</span><div class="item-actions"><UButton size="xs" label="标记已读" @click="useQB.batchRead(true)" /><UButton size="xs" label="标记未读" @click="useQB.batchRead(false)" /><UButton size="xs" label="设为公开" @click="useQB.batchSetPublic(true)" /><UButton size="xs" color="error" label="批量删除" @click="deleteBatchOpen = true" /><UButton size="xs" color="neutral" variant="ghost" label="取消" @click="useQB.clearSelection()" /></div></div></UCard></Transition>
    <UModal :open="Boolean(deleteTarget)" title="删除提问" @update:open="(open) => !open && (deleteTarget = null)"><template #body>确认删除这条提问？</template><template #footer><div class="modal-actions"><UButton color="neutral" variant="soft" label="取消" @click="deleteTarget = null" /><UButton color="error" label="删除" @click="deleteOne" /></div></template></UModal>
    <UModal v-model:open="deleteBatchOpen" title="批量删除"><template #body>确认删除选中的 {{ useQB.selectedIds.length }} 条提问？</template><template #footer><div class="modal-actions"><UButton color="neutral" variant="soft" label="取消" @click="deleteBatchOpen = false" /><UButton color="error" label="删除" @click="deleteSelected" /></div></template></UModal>
  </div>
</template>

<style scoped>
.received-tab { display:flex; flex-direction:column; gap:12px; }.filter-bar,.filter-bar__group,.item-actions,.pagination,.batch-bar__content,.modal-actions { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }.filter-bar { justify-content:space-between; }.search-input { width:160px; }.select-input { width:120px; }.sort-input { width:130px; }.pagination { justify-content:space-between; }.batch-bar { position:fixed; bottom:24px; left:50%; z-index:100; width:auto; max-width:90vw; transform:translateX(-50%); box-shadow:var(--vtsuru-shadow-floating); }.batch-bar__content { justify-content:space-between; }.modal-actions { justify-content:flex-end; }.slide-up-enter-active,.slide-up-leave-active { transition:all .2s ease; }.slide-up-enter-from,.slide-up-leave-to { transform:translateX(-50%) translateY(20px); opacity:0; }
</style>
