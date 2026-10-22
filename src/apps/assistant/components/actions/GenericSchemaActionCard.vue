<script setup lang="ts">
import { computed } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

import type { AssistantPreviewItem, EditableField, ProposalEditItem } from '../../api/assistant'

const props = defineProps<{ preview: AssistantPreviewItem[]; editable?: boolean }>()

/** 编辑草稿: 按预览下标承载各字段新值, 双向绑定 */
const draft = defineModel<ProposalEditItem[]>('draft')

const OP_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  add: { label: '新增', variant: 'default' },
  modify: { label: '修改', variant: 'outline' },
  delete: { label: '删除', variant: 'destructive' },
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

function setFieldValue(index: number, key: string, value: string | number) {
  const entry = draft.value?.find((d) => d.index === index)
  if (entry) entry.values[key] = String(value)
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
  <div class="w-full flex flex-col gap-1.5">
    <div
      v-if="preview.length"
      class="flex flex-col gap-1.5"
    >
      <div
        v-for="(item, i) in preview"
        :key="i"
        class="generic-item flex flex-col gap-1 p-2 rounded-md bg-muted/40 border border-border/50 text-xs"
      >
        <div class="generic-item__head flex items-center gap-1.5">
          <Badge
            :variant="OP_META[item.op]?.variant ?? 'secondary'"
            class="text-[10px] h-4.5 px-1 font-normal"
          >
            {{ OP_META[item.op]?.label ?? item.op }}
          </Badge>
          <span class="generic-item__title font-medium truncate flex-1 min-w-0 text-foreground">{{ item.title }}</span>
          <span
            v-if="item.time"
            class="generic-item__time text-[11px] text-muted-foreground font-mono"
          >
            {{ item.time }}
          </span>
        </div>

        <!-- 编辑态: 该项有可编辑字段时渲染输入框 -->
        <div
          v-if="editable && item.fields?.length"
          class="generic-item__edit flex flex-col gap-2 mt-1 pt-1 border-t border-border/40"
        >
          <div
            v-for="f in item.fields"
            :key="f.key"
            class="edit-field flex flex-col gap-1"
          >
            <span class="edit-field__label text-[11px] text-muted-foreground font-medium">
              {{ f.label }}
            </span>
            <Select
              v-if="f.type === 'select'"
              :model-value="fieldValue(i, f.key)"
              @update:model-value="setSelectValue(i, f.key, $event)"
            >
              <SelectTrigger size="xs">
                <SelectValue :placeholder="f.label" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in f.options"
                  :key="opt.value"
                  :value="String(opt.value)"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              v-else-if="f.type === 'textarea'"
              :model-value="fieldValue(i, f.key)"
              rows="2"
              class="text-xs resize-none"
              :placeholder="f.label"
              @update:model-value="setFieldValue(i, f.key, $event)"
            />
            <Input
              size="xs"
              v-else
              :model-value="fieldValue(i, f.key)"
              :placeholder="f.type === 'tags' ? '逗号分隔' : f.label"
              @update:model-value="setFieldValue(i, f.key, $event)"
            />
          </div>
        </div>

        <!-- 只读态: 结构化字段对比 (field 带 before, 编辑后不过期) -->
        <div
          v-else-if="hasFieldDiff(item)"
          class="generic-item__struct flex flex-col gap-1 mt-0.5 text-xs"
        >
          <div
            v-for="f in item.fields"
            :key="f.key"
            class="struct-field flex items-baseline gap-1.5"
          >
            <span class="struct-field__label text-muted-foreground shrink-0 text-[11px] min-w-12">
              {{ f.label }}:
            </span>
            <span
              v-if="fieldChanged(f)"
              class="struct-field__val struct-field__val--changed inline-flex items-center gap-1 flex-wrap px-1.5 py-0.5 rounded bg-emerald-500/10"
            >
              <span class="line-through text-muted-foreground">{{
                f.before || (f.type === 'tags' ? '无' : '空')
              }}</span>
              <span class="struct-field__arrow text-muted-foreground">→</span>
              <span class="struct-field__after text-emerald-600 dark:text-emerald-400 font-medium">{{
                displayValue(f)
              }}</span>
            </span>
            <span
              v-else
              class="struct-field__val text-muted-foreground"
            >
              {{ displayValue(f) }}
            </span>
          </div>
        </div>

        <!-- 只读态: 整串逐字段 diff (无 Fields 原值时回退) -->
        <template v-else>
          <div
            v-if="diffs[i]"
            class="generic-item__fields flex items-center gap-2 flex-wrap text-xs"
          >
            <template
              v-for="(f, fi) in diffs[i]!"
              :key="fi"
            >
              <span
                v-if="f.changed"
                class="field field--changed inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
              >
                <span class="line-through text-muted-foreground font-normal">{{ f.before }}</span>
                <span class="field__arrow text-muted-foreground font-normal">→</span>
                <span>{{ f.after }}</span>
              </span>
              <span
                v-else
                class="field field--same text-muted-foreground"
              >
                {{ f.after }}
              </span>
            </template>
          </div>
          <div
            v-else-if="item.before || item.after"
            class="generic-item__diff flex items-center gap-1.5 flex-wrap text-xs"
          >
            <span
              v-if="item.before"
              class="line-through text-muted-foreground"
            >
              {{ item.before }}
            </span>
            <span
              v-if="item.before && item.after"
              class="diff-arrow text-muted-foreground"
            >
              →
            </span>
            <span
              v-if="item.after"
              class="text-emerald-600 dark:text-emerald-400 font-medium"
            >
              {{ item.after }}
            </span>
          </div>
        </template>

        <p
          v-if="item.note"
          class="generic-item__note text-muted-foreground text-[11px] mt-0.5"
        >
          {{ item.note }}
        </p>
        <a
          v-if="item.url"
          :href="item.url"
          target="_blank"
          rel="noreferrer"
          class="generic-item__link text-primary hover:underline text-xs self-start"
        >
          查看工单
        </a>
      </div>
    </div>
    <Empty
      v-else
      description="暂无可预览的字段"
      class="py-4 text-xs"
    />
  </div>
</template>

