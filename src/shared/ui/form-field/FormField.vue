<script setup lang="ts">
import { Info } from 'lucide-vue-next'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { cn } from '@/shared/utils/cn'

defineOptions({ name: 'FormField' })

export interface FormSelectOption {
  label: string
  value: any
}

const props = defineProps<{
  label?: string
  required?: boolean
  hint?: string
  description?: string
  error?: string
  extra?: string | number
  type?: 'text' | 'number' | 'select' | 'textarea' | 'password'
  disabled?: boolean
  placeholder?: string
  min?: number | string
  max?: number | string
  step?: number | string
  rows?: number
  maxlength?: number
  options?: Array<FormSelectOption | string>
  controlClass?: HTMLAttributes['class']
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  (e: 'change', val: any): void
  (e: 'blur', evt: FocusEvent): void
}>()

const model = defineModel<any>()

function handleModelUpdate(val: any) {
  model.value = val
  emit('change', val)
}

function handleBlur(evt: FocusEvent) {
  emit('blur', evt)
}

const normalizedOptions = computed<FormSelectOption[]>(() => {
  if (!props.options) return []
  return props.options.map((opt) => (typeof opt === 'string' ? { label: opt, value: opt } : opt))
})
</script>

<template>
  <div :class="cn('flex flex-col gap-1.5 text-xs', props.class)">
    <div
      v-if="label || $slots.label || hint || $slots.hint || extra !== undefined || $slots.extra"
      class="flex items-center gap-1 min-h-[18px]"
    >
      <slot name="label">
        <label
          v-if="label"
          class="font-medium text-foreground select-none"
        >
          {{ label }}
          <span
            v-if="required"
            class="text-destructive font-bold ml-0.5"
            aria-hidden="true"
            >*</span
          >
        </label>
      </slot>

      <Tooltip v-if="hint || $slots.hint">
        <TooltipTrigger as-child>
          <button
            type="button"
            class="inline-flex-center text-muted-foreground hover:text-foreground cursor-help p-0 bg-transparent border-0 shrink-0"
            aria-label="字段提示"
          >
            <Info class="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent class="max-w-[320px] whitespace-pre-wrap leading-relaxed">
          <slot name="hint">
            {{ hint }}
          </slot>
        </TooltipContent>
      </Tooltip>

      <slot name="extra">
        <span
          v-if="extra !== undefined"
          class="ml-auto text-[11px] text-muted-foreground tabular-nums select-none"
        >
          {{ extra }}
        </span>
      </slot>
    </div>

    <slot name="description">
      <p
        v-if="description"
        class="text-[11px] text-muted-foreground leading-relaxed -mt-0.5"
      >
        {{ description }}
      </p>
    </slot>

    <slot>
      <!-- 预制：单行文本 -->
      <Input
        v-if="type === 'text'"
        :model-value="model !== undefined && model !== null ? String(model) : ''"
        :placeholder="placeholder"
        :disabled="disabled"
        :maxlength="maxlength"
        :class="controlClass"
        @update:model-value="handleModelUpdate"
        @blur="handleBlur"
      />

      <!-- 预制：密码框 -->
      <Input
        v-else-if="type === 'password'"
        type="password"
        :model-value="model !== undefined && model !== null ? String(model) : ''"
        :placeholder="placeholder"
        :disabled="disabled"
        :maxlength="maxlength"
        :class="controlClass"
        @update:model-value="handleModelUpdate"
        @blur="handleBlur"
      />

      <!-- 预制：数字输入 -->
      <NumberField
        v-else-if="type === 'number'"
        :model-value="model !== undefined && model !== null ? Number(model) : undefined"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        :placeholder="placeholder"
        :class="controlClass"
        @update:model-value="handleModelUpdate"
      />

      <!-- 预制：下拉框 -->
      <Select
        v-else-if="type === 'select'"
        :model-value="model !== undefined && model !== null ? String(model) : ''"
        :disabled="disabled"
        @update:model-value="handleModelUpdate"
      >
        <SelectTrigger :class="controlClass">
          <SelectValue :placeholder="placeholder" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in normalizedOptions"
            :key="String(opt.value)"
            :value="String(opt.value)"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <!-- 预制：多行文本 -->
      <Textarea
        v-else-if="type === 'textarea'"
        :model-value="model !== undefined && model !== null ? String(model) : ''"
        :placeholder="placeholder"
        :disabled="disabled"
        :rows="rows || 3"
        :maxlength="maxlength"
        :class="controlClass"
        @update:model-value="handleModelUpdate"
        @blur="handleBlur"
      />
    </slot>

    <slot name="error">
      <p
        v-if="error"
        class="text-[11px] text-destructive leading-tight mt-0.5"
      >
        {{ error }}
      </p>
    </slot>
  </div>
</template>
