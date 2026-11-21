<script setup lang="ts">
import { Plus, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

export interface ChipOption {
  label: string
  value: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options?: ChipOption[]
    placeholder?: string
    disabled?: boolean
    maxSuggestions?: number
  }>(),
  {
    options: () => [],
    placeholder: '输入后按回车或逗号添加',
    disabled: false,
    maxSuggestions: 16,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const inputText = ref('')

const selectedSet = computed(() => new Set(props.modelValue))

const filteredSuggestions = computed(() => {
  const kw = inputText.value.trim().toLowerCase()
  const list = props.options.filter((opt) => {
    if (!opt.value.trim()) return false
    if (!kw) return true
    return opt.label.toLowerCase().includes(kw) || opt.value.toLowerCase().includes(kw)
  })
  return list.slice(0, props.maxSuggestions)
})

function addFromInput() {
  if (props.disabled) return
  const parts = inputText.value
    .split(/[,，]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!parts.length) return
  const next = [...props.modelValue]
  for (const part of parts) {
    if (!next.includes(part)) next.push(part)
  }
  emit('update:modelValue', next)
  inputText.value = ''
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    addFromInput()
  }
}

function toggleSuggestion(value: string) {
  if (props.disabled) return
  if (selectedSet.value.has(value)) {
    emit(
      'update:modelValue',
      props.modelValue.filter((item) => item !== value),
    )
  } else {
    emit('update:modelValue', [...props.modelValue, value])
  }
}

function removeValue(value: string) {
  if (props.disabled) return
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item !== value),
  )
}
</script>

<template>
  <div class="space-y-2 min-w-0">
    <div class="flex items-center gap-1.5">
      <Input
        v-model="inputText"
        :placeholder="placeholder"
        :disabled="disabled"
        class="flex-1 min-w-0"
        @keydown="handleKeydown"
        @blur="addFromInput"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        :disabled="disabled || !inputText.trim()"
        title="添加"
        @click="addFromInput"
      >
        <Plus class="size-3.5" />
      </Button>
    </div>

    <div
      v-if="modelValue.length > 0"
      class="flex flex-wrap gap-1"
    >
      <Badge
        v-for="item in modelValue"
        :key="item"
        variant="secondary"
        class="gap-1 pr-1 font-normal"
      >
        <span class="truncate max-w-40">{{ item }}</span>
        <button
          v-if="!disabled"
          type="button"
          class="rounded-sm hover:text-destructive cursor-pointer inline-flex-center"
          :aria-label="`移除 ${item}`"
          @click="removeValue(item)"
        >
          <X class="size-3" />
        </button>
      </Badge>
    </div>

    <div
      v-if="filteredSuggestions.length > 0"
      class="flex flex-wrap items-center gap-1 pt-0.5"
    >
      <span class="text-[11px] text-muted-foreground mr-0.5">已有:</span>
      <button
        v-for="opt in filteredSuggestions"
        :key="opt.value"
        type="button"
        :disabled="disabled"
        class="px-1.5 py-0.5 rounded text-[11px] border transition-colors cursor-pointer disabled:opacity-50"
        :class="
          selectedSet.has(opt.value)
            ? 'border-primary/40 bg-primary/10 text-primary font-medium'
            : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted'
        "
        @click="toggleSuggestion(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
