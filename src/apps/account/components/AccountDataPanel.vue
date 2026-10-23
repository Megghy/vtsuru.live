<script setup lang="ts">
export interface AccountStatItem {
  label: string
  value: string | number
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'
}

defineProps<{
  stats: AccountStatItem[]
}>()

const TONE_CARD: Record<string, string> = {
  default: '',
  primary: 'border-primary/30 bg-primary/5',
  success:
    'border-[color-mix(in_srgb,var(--vtsuru-success)_32%,var(--border))] bg-[color-mix(in_srgb,var(--vtsuru-success)_4%,var(--card))]',
  warning:
    'border-[color-mix(in_srgb,var(--vtsuru-warning)_32%,var(--border))] bg-[color-mix(in_srgb,var(--vtsuru-warning)_4%,var(--card))]',
  error:
    'border-[color-mix(in_srgb,var(--vtsuru-error)_32%,var(--border))] bg-[color-mix(in_srgb,var(--vtsuru-error)_4%,var(--card))]',
  info: 'border-[color-mix(in_srgb,var(--vtsuru-info)_32%,var(--border))] bg-[color-mix(in_srgb,var(--vtsuru-info)_4%,var(--card))]',
}

const TONE_VALUE: Record<string, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  success: 'text-[var(--vtsuru-success)]',
  warning: 'text-[var(--vtsuru-warning)]',
  error: 'text-[var(--vtsuru-error)]',
  info: 'text-[var(--vtsuru-info)]',
}
</script>

<template>
  <div class="flex flex-col gap-3 mb-3">
    <div class="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5 max-[640px]:grid-cols-2 max-[640px]:gap-2">
      <div
        v-for="item in stats"
        :key="item.label"
        class="flex flex-col justify-between min-w-0 py-3 px-3.5 max-[640px]:py-2.5 max-[640px]:px-3 border border-border rounded-[var(--radius)] bg-card shadow-sm transition-colors hover:border-input"
        :class="TONE_CARD[item.tone ?? 'default']"
      >
        <span class="block text-muted-foreground text-xs font-medium leading-snug truncate">{{ item.label }}</span>
        <strong
          class="block mt-1 text-xl max-[640px]:text-lg font-bold leading-tight tabular-nums truncate"
          :class="TONE_VALUE[item.tone ?? 'default']"
        >
          {{ item.value }}
        </strong>
      </div>
    </div>

    <div
      v-if="$slots.toolbar"
      class="py-2.5 px-3 border border-border rounded-[var(--radius)] bg-card shadow-sm"
    >
      <slot name="toolbar" />
    </div>
  </div>
</template>
