<script setup lang="ts">
import { computed } from 'vue'

import type { AssistantPreviewItem, EditableField, ProposalEditItem } from '../../api/assistant'

const props = defineProps<{ preview: AssistantPreviewItem[]; editable?: boolean }>()

/** 编辑草稿: 按预览下标承载各字段新值, 双向绑定 */
const draft = defineModel<ProposalEditItem[]>('draft')

const OP_META: Record<string, { label: string; type: 'success' | 'warning' | 'error' | 'default' }> = {
  add: { label: '新增', type: 'success' },
  modify: { label: '修改', type: 'warning' },
  delete: { label: '删除', type: 'error' },
}

/** field 带 before(原值)时, 用结构化字段对比展示 (编辑后不过期); 否则回退 before/after 整串 diff */
function hasFieldDiff(item: AssistantPreviewItem) {
  return item.fields?.some((f) => f.before != null) ?? false
}

function fieldChanged(f: EditableField) {
  return f.before != null && f.before !== f.value
}

/** before/after 是 " | " 分隔的同构字段串, 逐段对比, 只标出真正变化的字段 */
type FieldDiff = { changed: boolean; before: string; after: string }

function splitFields(text: string) {
  return text
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
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
  props.preview.map((item) =>
    !hasFieldDiff(item) && item.before && item.after ? diffFields(item.before, item.after) : null,
  ),
)

/** 取某预览项在草稿里对应字段的当前值 */
function fieldValue(index: number, key: string) {
  return draft.value?.find((d) => d.index === index)?.values[key] ?? ''
}

function setFieldValue(index: number, key: string, value: string) {
  const entry = draft.value?.find((d) => d.index === index)
  if (entry) entry.values[key] = value
}

function setSelectValue(index: number, key: string, value: unknown) {
  if (value != null) setFieldValue(index, key, String(value))
}

function displayValue(f: EditableField) {
  const value = f.options?.find((option) => option.value === f.value)?.label ?? f.value
  return value || (f.type === 'tags' ? '无' : '空')
}
</script>

<template>
  <div class="generic-card">
    <div
      v-if="preview.length"
      class="generic-card__list"
    >
      <div
        v-for="(item, i) in preview"
        :key="i"
        class="generic-item"
      >
        <div class="generic-item__head">
          <UBadge
            size="sm"
            :color="OP_META[item.op]?.type === 'default' ? 'neutral' : OP_META[item.op]?.type"
            variant="subtle"
          >
            {{ OP_META[item.op]?.label ?? item.op }}
          </UBadge>
          <span class="generic-item__title">{{ item.title }}</span>
          <span
            v-if="item.time"
            class="generic-item__time"
          >
            {{ item.time }}
          </span>
        </div>

        <!-- 编辑态: 该项有可编辑字段时渲染输入框 -->
        <div
          v-if="editable && item.fields?.length"
          class="generic-item__edit"
        >
          <div
            v-for="f in item.fields"
            :key="f.key"
            class="edit-field"
          >
            <span class="edit-field__label">
              {{ f.label }}
            </span>
            <USelect
              v-if="f.type === 'select'"
              :model-value="fieldValue(i, f.key)"
              :items="f.options"
              size="sm"
              @update:model-value="setSelectValue(i, f.key, $event)"
            />
            <UTextarea
              v-else-if="f.type === 'textarea'"
              :model-value="fieldValue(i, f.key)"
              autoresize
              :rows="2"
              :maxrows="6"
              :placeholder="f.label"
              size="sm"
              @update:model-value="setFieldValue(i, f.key, $event)"
            />
            <UInput
              v-else
              :model-value="fieldValue(i, f.key)"
              :placeholder="f.type === 'tags' ? '逗号分隔' : f.label"
              size="sm"
              @update:model-value="setFieldValue(i, f.key, $event)"
            />
          </div>
        </div>

        <!-- 只读态: 结构化字段对比 (field 带 before, 编辑后不过期) -->
        <div
          v-else-if="hasFieldDiff(item)"
          class="generic-item__struct"
        >
          <div
            v-for="f in item.fields"
            :key="f.key"
            class="struct-field"
          >
            <span class="struct-field__label">
              {{ f.label }}
            </span>
            <span
              v-if="fieldChanged(f)"
              class="struct-field__val struct-field__val--changed"
            >
              <del>{{ f.before || (f.type === 'tags' ? '无' : '空') }}</del>
              <span class="struct-field__arrow">→</span>
              <span class="struct-field__after">{{ displayValue(f) }}</span>
            </span>
            <span
              v-else
              class="struct-field__val"
            >
              {{ displayValue(f) }}
            </span>
          </div>
        </div>

        <!-- 只读态: 整串逐字段 diff (无 Fields 原值时回退) -->
        <template v-else>
          <div
            v-if="diffs[i]"
            class="generic-item__fields"
          >
            <template
              v-for="(f, fi) in diffs[i]!"
              :key="fi"
            >
              <span
                v-if="f.changed"
                class="field field--changed"
              >
                <del class="field__before">{{ f.before }}</del>
                <span class="field__arrow">→</span>
                <span class="field__after">{{ f.after }}</span>
              </span>
              <span
                v-else
                class="field field--same"
              >
                {{ f.after }}
              </span>
            </template>
          </div>
          <div
            v-else-if="item.before || item.after"
            class="generic-item__diff"
          >
            <del v-if="item.before">
              {{ item.before }}
            </del>
            <span
              v-if="item.before && item.after"
              class="diff-arrow"
              >→</span
            >
            <span
              v-if="item.after"
              class="generic-item__after"
            >
              {{ item.after }}
            </span>
          </div>
        </template>

        <p
          v-if="item.note"
          class="generic-item__note"
        >
          {{ item.note }}
        </p>
        <UButton
          v-if="item.url"
          variant="link"
          tag="a"
          :href="item.url"
          class="generic-item__link"
        >
          查看工单
        </UButton>
      </div>
    </div>
    <UEmpty
      v-else
      description="暂无可预览的字段"
    />
  </div>
</template>

<style scoped>
.generic-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.generic-card__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.generic-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--vtsuru-bg-elevated, rgba(128, 128, 128, 0.06));
}
.generic-item__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.generic-item__title {
  font-weight: 500;
  min-width: 0;
  word-break: break-word;
}
.generic-item__time {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

/* 整串逐字段 diff */
.generic-item__fields {
  display: flex;
  align-items: center;
  gap: 4px 10px;
  flex-wrap: wrap;
  font-size: 12px;
}
.field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.field--changed {
  padding: 0 6px;
  border-radius: 4px;
  background: var(--vtsuru-success-soft, rgba(24, 160, 88, 0.12));
}
.field__arrow {
  color: var(--vtsuru-fg-muted);
}
.field__after {
  font-weight: 600;
  color: var(--vtsuru-success);
}

/* 结构化字段对比 */
.generic-item__struct {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 2px;
}
.struct-field {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
}
.struct-field__label {
  flex-shrink: 0;
  min-width: 48px;
  color: var(--vtsuru-fg-muted);
}
.struct-field__val {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  word-break: break-word;
}
.struct-field__val--changed {
  padding: 0 6px;
  border-radius: 4px;
  background: var(--vtsuru-success-soft, rgba(24, 160, 88, 0.12));
}
.struct-field__arrow {
  color: var(--vtsuru-fg-muted);
}
.struct-field__after {
  font-weight: 600;
  color: var(--vtsuru-success);
}

.generic-item__diff {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
}
.diff-arrow {
  color: var(--vtsuru-fg-muted);
}
.generic-item__note {
  margin: 0;
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.generic-item__after {
  color: var(--vtsuru-success);
}
.generic-item__link {
  align-self: flex-start;
  font-size: 12px;
}
.generic-item__edit {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}
.edit-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.edit-field__label {
  font-size: 12px;
}
</style>
