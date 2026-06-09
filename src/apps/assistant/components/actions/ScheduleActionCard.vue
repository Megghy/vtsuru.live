<script setup lang="ts">
import { NButton, NFlex, NInput, NTag, NText } from 'naive-ui'
import { computed } from 'vue'
import type { AssistantPreviewItem, ScheduleEditItem } from '../../api/assistant'

const props = defineProps<{ preview: AssistantPreviewItem[], editable?: boolean }>()

/** 编辑态: 按预览下标双向绑定可改字段 */
const model = defineModel<ScheduleEditItem[]>('draft')

const OP_META: Record<string, { label: string, type: 'success' | 'warning' | 'error' }> = {
  add: { label: '新增', type: 'success' },
  modify: { label: '修改', type: 'warning' },
  delete: { label: '删除', type: 'error' },
}

/** 编辑态下, 仅 add/modify 可改; delete 仅展示 */
const editableIndexes = computed(() =>
  props.preview.map((it, i) => ({ it, i })).filter(({ it }) => it.op !== 'delete'),
)

function fieldOf(index: number) {
  return model.value?.find(m => m.index === index)
}
</script>

<template>
  <!-- 只读预览 -->
  <div v-if="!editable" class="schedule-card">
    <div class="schedule-card__list">
      <div v-for="(item, i) in preview" :key="i" class="schedule-item">
        <NTag size="small" :type="OP_META[item.op]?.type" :bordered="false">
          {{ OP_META[item.op]?.label ?? item.op }}
        </NTag>
        <div class="schedule-item__body">
          <NFlex align="center" :size="6" :wrap="false">
            <span class="schedule-item__title">{{ item.title }}</span>
            <NText v-if="item.time" depth="3" class="schedule-item__time">{{ item.time }}</NText>
          </NFlex>
          <div v-if="item.before || item.after" class="schedule-item__diff">
            <NText v-if="item.before" delete depth="3">{{ item.before }}</NText>
            <span v-if="item.before && item.after" class="diff-arrow">→</span>
            <NText v-if="item.after" type="success">{{ item.after }}</NText>
          </div>
          <NText v-if="item.note" depth="3" class="schedule-item__note">{{ item.note }}</NText>
        </div>
      </div>
    </div>
  </div>

  <!-- 编辑态: 仅 add/modify 项可改标题与时间 -->
  <div v-else class="schedule-edit">
    <div v-for="{ i } in editableIndexes" :key="i" class="schedule-edit__item">
      <NFlex :size="6" :wrap="false" align="center">
        <NTag size="tiny" :type="OP_META[preview[i].op]?.type" :bordered="false">
          {{ OP_META[preview[i].op]?.label }}
        </NTag>
        <NInput
          v-if="fieldOf(i)"
          v-model:value="fieldOf(i)!.title"
          size="small"
          placeholder="标题"
        />
      </NFlex>
      <NInput
        v-if="fieldOf(i)"
        v-model:value="fieldOf(i)!.time"
        size="small"
        placeholder="时间 HH:mm"
      />
    </div>
    <NText v-if="!editableIndexes.length" depth="3" class="schedule-edit__hint">
      该方案仅含删除操作, 无可编辑字段
    </NText>
  </div>
</template>

<style scoped>
.schedule-card { display: flex; flex-direction: column; gap: 8px; }
.schedule-card__list { display: flex; flex-direction: column; gap: 6px; }
.schedule-item {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 6px 8px; border-radius: 6px;
  background: var(--n-color-modal, rgba(128, 128, 128, 0.06));
}
.schedule-item__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.schedule-item__title { font-size: 13px; font-weight: 500; }
.schedule-item__time { font-size: 12px; }
.schedule-item__diff { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; }
.diff-arrow { color: var(--n-text-color-3); }
.schedule-item__note { font-size: 12px; }
.schedule-edit { display: flex; flex-direction: column; gap: 8px; }
.schedule-edit__item {
  display: flex; flex-direction: column; gap: 4px;
  padding: 6px 8px; border-radius: 6px;
  background: var(--n-color-modal, rgba(128, 128, 128, 0.06));
}
.schedule-edit__hint { font-size: 12px; }
</style>
