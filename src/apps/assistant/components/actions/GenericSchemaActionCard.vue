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
    <div v-if="preview.length" class="generic-card__list">
      <div v-for="(item, i) in preview" :key="i" class="generic-item">
        <div class="generic-item__head">
          <NTag size="small" :type="OP_META[item.op]?.type ?? 'default'" :bordered="false">
            {{ OP_META[item.op]?.label ?? item.op }}
          </NTag>
          <span class="generic-item__title">{{ item.title }}</span>
          <NText v-if="item.time" depth="3" class="generic-item__time">
            {{ item.time }}
          </NText>
        </div>
        <div v-if="item.before || item.after" class="generic-item__diff">
          <NText v-if="item.before" delete depth="3">
            {{ item.before }}
          </NText>
          <span v-if="item.before && item.after" class="diff-arrow">→</span>
          <NText v-if="item.after" type="success">
            {{ item.after }}
          </NText>
        </div>
        <NText v-if="item.note" depth="3" class="generic-item__note">
          {{ item.note }}
        </NText>
      </div>
    </div>
    <NEmpty v-else size="small" description="暂无可预览的字段" />
  </div>
</template>

<style scoped>
.generic-card { display: flex; flex-direction: column; gap: 6px; }
.generic-card__list { display: flex; flex-direction: column; gap: 6px; }
.generic-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 6px 8px; border-radius: 6px;
  background: var(--n-color-modal, rgba(128, 128, 128, 0.06));
}
.generic-item__head { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.generic-item__title { font-weight: 500; min-width: 0; word-break: break-word; }
.generic-item__time { font-size: 12px; }
.generic-item__diff { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; }
.diff-arrow { color: var(--n-text-color-3); }
.generic-item__note { font-size: 12px; }
</style>
