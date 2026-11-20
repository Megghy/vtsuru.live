<script setup lang="ts">
import { Checkbox } from '@/shared/ui/checkbox'
import { cn } from '@/shared/utils/cn'

withDefaults(
  defineProps<{
    index: number
    indexClass?: string
    highlighted?: boolean
    selectionMode?: boolean
    selected?: boolean
    selectLabel?: string
    columnsClass?: string
  }>(),
  {
    indexClass: 'bg-primary/10 text-primary',
    highlighted: false,
    selectionMode: false,
    selected: false,
    selectLabel: '选择此条目',
    columnsClass: 'md:grid-cols-[13.5rem_minmax(0,1fr)_auto]',
  },
)

const emit = defineEmits<{
  (e: 'toggle-select', checked: boolean): void
}>()
</script>

<template>
  <div
    :class="
      cn(
        'grid grid-cols-1 items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card/60 hover:bg-card transition-colors',
        columnsClass,
        highlighted ? 'border-l-4 border-l-emerald-500 bg-emerald-500/5' : 'hover:border-primary/40',
      )
    "
  >
    <div class="flex items-center gap-2 min-w-0">
      <Checkbox
        v-if="selectionMode"
        :checked="Boolean(selected)"
        :aria-label="selectLabel"
        @update:checked="(val) => emit('toggle-select', Boolean(val))"
      />

      <span
        class="inline-flex-center font-bold size-6 rounded-full text-xs shrink-0 font-mono tabular-nums"
        :class="indexClass"
      >
        {{ index }}
      </span>

      <slot name="primary" />
    </div>

    <div
      data-slot="row-context"
      class="flex items-center gap-1.5 min-w-0 flex-wrap"
    >
      <slot name="context" />
    </div>

    <div class="flex items-center justify-between md:justify-end gap-2 shrink-0">
      <slot name="meta" />
      <div class="flex items-center gap-1 shrink-0">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
