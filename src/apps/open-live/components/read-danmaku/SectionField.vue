<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

defineProps<{
  label: string
  hint?: string
  value?: string | number
}>()
</script>

<template>
  <div class="section-field">
    <div class="head">
      <span class="label">{{ label }}</span>
      <Popover v-if="hint || $slots.hint">
        <PopoverTrigger as-child>
          <button
            type="button"
            class="text-muted-foreground hover:text-foreground cursor-help inline-flex items-center"
          >
            <Info24Filled class="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent class="max-w-[360px] text-xs p-3">
          <slot name="hint">
            <span class="leading-relaxed whitespace-pre-wrap">{{ hint }}</span>
          </slot>
        </PopoverContent>
      </Popover>
      <span
        v-if="value !== undefined"
        class="value"
      >{{ value }}</span>
    </div>
    <div class="body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.section-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.head {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 18px;
}
.label {
  font-size: 12px;
  font-weight: 500;
  color: var(--vtsuru-fg);
}
.value {
  margin-left: auto;
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  font-variant-numeric: tabular-nums;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
