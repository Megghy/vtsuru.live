<script setup lang="ts">
import { Info } from 'lucide-vue-next'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { cn } from '@/shared/utils/cn'

defineOptions({ name: 'SettingRow' })

export interface SelectOption {
  label: string
  value: any
}

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    badge?: string
    hint?: string
    variant?: 'card' | 'line' | 'compact' | 'none'
    type?: 'switch' | 'number' | 'select' | 'text'
    disabled?: boolean
    placeholder?: string
    min?: number | string
    max?: number | string
    step?: number | string
    options?: Array<SelectOption | string>
    controlClass?: HTMLAttributes['class']
    class?: HTMLAttributes['class']
  }>(),
  {
    variant: 'card',
  },
)

const emit = defineEmits<{
  (e: 'change', val: any): void
}>()

const model = defineModel<any>()

function handleModelUpdate(val: any) {
  model.value = val
  emit('change', val)
}

const normalizedOptions = computed<SelectOption[]>(() => {
  if (!props.options) return []
  return props.options.map((opt) => (typeof opt === 'string' ? { label: opt, value: opt } : opt))
})

const variantClasses: Record<string, string> = {
  card: 'p-2.5 rounded-lg border border-border/70 bg-card hover:bg-accent/10 transition-colors',
  line: 'py-2.5 border-b border-border/60',
  compact: 'p-2 rounded-md border border-border/60 bg-muted/20',
  none: '',
}
</script>

<template>
  <div
    :class="
      cn(
        'flex-between gap-3 text-xs',
        variantClasses[props.variant] || variantClasses.card,
        props.class,
      )
    "
  >
    <div class="flex flex-col min-w-0 flex-1">
      <div class="flex items-center gap-1.5 min-w-0">
        <slot name="title">
          <span
            v-if="title"
            class="font-medium text-foreground truncate"
          >
            {{ title }}
          </span>
        </slot>

        <slot name="badge">
          <Badge
            v-if="badge"
            size="xs"
            variant="secondary"
          >
            {{ badge }}
          </Badge>
        </slot>

        <Tooltip v-if="hint || $slots.hint">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="inline-flex-center text-muted-foreground hover:text-foreground cursor-help p-0 bg-transparent border-0 shrink-0"
              aria-label="配置项说明"
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
      </div>

      <slot name="description">
        <p
          v-if="description"
          class="text-[11px] text-muted-foreground leading-relaxed mt-0.5"
        >
          {{ description }}
        </p>
      </slot>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <slot>
        <!-- 预制：开关 -->
        <Switch
          v-if="type === 'switch'"
          :checked="Boolean(model)"
          :disabled="disabled"
          :class="controlClass"
          @update:checked="handleModelUpdate"
        />

        <!-- 预制：数字输入 -->
        <NumberField
          v-else-if="type === 'number'"
          :model-value="model !== undefined && model !== null ? Number(model) : undefined"
          :min="min"
          :max="max"
          :step="step"
          :disabled="disabled"
          size="xs"
          :class="cn('w-28', controlClass)"
          @update:model-value="handleModelUpdate"
        />

        <!-- 预制：下拉框 -->
        <Select
          v-else-if="type === 'select'"
          :model-value="model !== undefined && model !== null ? String(model) : ''"
          :disabled="disabled"
          @update:model-value="handleModelUpdate"
        >
          <SelectTrigger
            size="xs"
            :class="cn('w-32', controlClass)"
          >
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

        <!-- 预制：单行文本 -->
        <Input
          v-else-if="type === 'text'"
          :model-value="model !== undefined && model !== null ? String(model) : ''"
          :placeholder="placeholder"
          :disabled="disabled"
          size="xs"
          :class="cn('w-36', controlClass)"
          @update:model-value="handleModelUpdate"
        />
      </slot>
    </div>
  </div>
</template>
