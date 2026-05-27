<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import { NIcon, NPopover } from 'naive-ui'

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
      <NPopover v-if="hint || $slots.hint" trigger="hover" placement="top" style="max-width: 360px">
        <template #trigger>
          <NIcon :component="Info24Filled" :size="14" class="icon" />
        </template>
        <slot name="hint">
          <span style="font-size: 12px; line-height: 1.6; white-space: pre-wrap">{{ hint }}</span>
        </slot>
      </NPopover>
      <span v-if="value !== undefined" class="value">{{ value }}</span>
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
  color: var(--n-text-color-2);
}
.icon {
  color: var(--n-text-color-3);
  cursor: help;
}
.value {
  margin-left: auto;
  font-size: 11px;
  color: var(--n-text-color-3);
  font-variant-numeric: tabular-nums;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
