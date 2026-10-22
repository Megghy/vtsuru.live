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
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center gap-1 min-h-[18px]">
      <span class="text-xs font-medium text-foreground">{{ label }}</span>
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
        class="ml-auto text-[11px] text-muted-foreground tabular-nums"
        >{{ value }}</span
      >
    </div>
    <div class="flex flex-col gap-1.5">
      <slot />
    </div>
  </div>
</template>
