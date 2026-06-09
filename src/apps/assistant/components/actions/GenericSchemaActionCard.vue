<script setup lang="ts">
import { NEmpty, NInput, NTag, NText } from 'naive-ui'
import { computed } from 'vue'
import type { AssistantPreviewItem, ProposalEditItem } from '../../api/assistant'

const props = defineProps<{ preview: AssistantPreviewItem[], editable?: boolean }>()

/** 编辑草稿: 按预览下标承载各字段新值, 双向绑定 */
const draft = defineModel<ProposalEditItem[]>('draft')

const OP_META: Record<string, { label: string, type: 'success' | 'warning' | 'error' | 'default' }> = {
  add: { label: '新增', type: 'success' },
  modify: { label: '修改', type: 'warning' },
  delete: { label: '删除', type: 'error' },
}

/** before/after 是 " | " 分隔的同构字段串, 逐段对比, 只标出真正变化的字段 */
type FieldDiff = { changed: boolean, before: string, after: string }

function splitFields(text: string) {
  return text.split('|').map(s => s.trim()).filter(Boolean)
}

function diffFields(before: string, after: string): FieldDiff[] {
  const b = splitFields(before)
  const a = splitFields(after)
  const len = Math.max(b.length, a.length)
  const result: FieldDiff[] = []
  for (let i = 0; i < len; i++) {
    result.push({ changed: (b[i] ?? '') !== (a[i] ?? ''), before: b[i] ?? '', after: a[i] ?? '' })
  }
  return result
}

const diffs = computed(() =>
  props.preview.map(item => (item.before && item.after ? diffFields(item.before, item.after) : null)),
)

/** 取某预览项在草稿里对应字段的当前值引用 */
function fieldValue(index: number, key: string) {
  const entry = draft.value?.find(d => d.index === index)
  return entry?.values[key] ?? ''
}

function setFieldValue(index: number, key: string, value: string) {
  const entry = draft.value?.find(d => d.index === index)
  if (entry) entry.values[key] = value
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

        <!-- 编辑态: 该项有可编辑字段时渲染输入框 -->
        <div v-if="editable && item.fields?.length" class="generic-item__edit">
          <div v-for="f in item.fields" :key="f.key" class="edit-field">
            <NText depth="3" class="edit-field__label">{{ f.label }}</NText>
            <NInput
              :value="fieldValue(i, f.key)"
              :type="f.type === 'textarea' ? 'textarea' : 'text'"
              :autosize="f.type === 'textarea' ? { minRows: 2, maxRows: 6 } : undefined"
              :placeholder="f.type === 'tags' ? '逗号分隔' : f.label"
              size="small"
              @update:value="setFieldValue(i, f.key, $event)"
            />
          </div>
        </div>

        <!-- 只读态: 逐字段对比, 未变灰显, 变化高亮 -->
        <template v-else>
          <div v-if="diffs[i]" class="generic-item__fields">
            <template v-for="(f, fi) in diffs[i]!" :key="fi">
              <span v-if="f.changed" class="field field--changed">
                <NText delete depth="3" class="field__before">{{ f.before }}</NText>
                <span class="field__arrow">→</span>
                <NText type="success" class="field__after">{{ f.after }}</NText>
              </span>
              <NText v-else depth="3" class="field field--same">{{ f.after }}</NText>
            </template>
          </div>
          <div v-else-if="item.before || item.after" class="generic-item__diff">
            <NText v-if="item.before" delete depth="3">
              {{ item.before }}
            </NText>
            <span v-if="item.before && item.after" class="diff-arrow">→</span>
            <NText v-if="item.after" type="success">
              {{ item.after }}
            </NText>
          </div>
        </template>

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
.generic-item__fields {
  display: flex; align-items: center; gap: 4px 10px; flex-wrap: wrap; font-size: 12px;
}
.field { display: inline-flex; align-items: center; gap: 4px; }
.field--changed {
  padding: 0 6px; border-radius: 4px;
  background: var(--n-color-success-suppl, rgba(24, 160, 88, 0.12));
}
.field__arrow { color: var(--n-text-color-3); }
.field__after { font-weight: 600; }
.generic-item__diff { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; }
.diff-arrow { color: var(--n-text-color-3); }
.generic-item__note { font-size: 12px; }
.generic-item__edit { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.edit-field { display: flex; flex-direction: column; gap: 2px; }
.edit-field__label { font-size: 12px; }
</style>