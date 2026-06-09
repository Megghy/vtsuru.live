<script setup lang="ts">
import { NEmpty, NTag, NText } from 'naive-ui'
import type { AssistantPreviewItem } from '../../api/assistant'

defineProps<{ preview: AssistantPreviewItem[] }>()

const OP_META: Record<string, { label: string, type: 'success' | 'warning' | 'error' | 'default' }> = {
  add: { label: '新增', type: 'success' },
  modify: { label: '修改', type: 'warning' },
  delete: { label: '删除', type: 'error' },
}
</script>

<template>
  <div class="generic-card">
    <NText depth="3" class="generic-card__hint">通用操作预览</NText>
    <div v-if="preview.length" class="generic-card__list">
      <div v-for="(item, i) in preview" :key="i" class="generic-item">
        <NTag size="small" :type="OP_META[item.op]?.type ?? 'default'" :bordered="false">
          {{ OP_META[item.op]?.label ?? item.op }}
        </NTag>
        <span class="generic-item__title">{{ item.title }}</span>
        <NText v-if="item.after" type="success" class="generic-item__after">{{ item.after }}</NText>
      </div>
    </div>
    <NEmpty v-else size="small" description="暂无可预览的字段" />
  </div>
</template>

<style scoped>
.generic-card { display: flex; flex-direction: column; gap: 6px; }
.generic-card__hint { font-size: 12px; }
.generic-card__list { display: flex; flex-direction: column; gap: 4px; }
.generic-item { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.generic-item__title { font-weight: 500; }
.generic-item__after { font-size: 12px; }
</style>
