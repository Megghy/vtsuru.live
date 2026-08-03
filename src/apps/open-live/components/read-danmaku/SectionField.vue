<script setup lang="ts">
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
      <UTooltip
        v-if="hint || $slots.hint"
        :content="{ side: 'top' }"
      >
        <UIcon
          name="i-lucide-info"
          :size="14"
          class="icon"
        />
        <template #content>
          <slot name="hint">
            <span style="font-size: 12px; line-height: 1.6; white-space: pre-wrap">{{ hint }}</span>
          </slot>
        </template>
      </UTooltip>
      <span
        v-if="value !== undefined"
        class="value"
        >{{ value }}</span
      >
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
.icon {
  color: var(--vtsuru-fg-muted);
  cursor: help;
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
