<script setup lang="ts">
export interface AccountStatItem {
  label: string
  value: string | number
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'
}

defineProps<{
  stats: AccountStatItem[]
}>()
</script>

<template>
  <div class="account-data-panel">
    <div class="account-stat-grid">
      <div
        v-for="item in stats"
        :key="item.label"
        class="account-stat"
        :class="`account-stat--${item.tone ?? 'default'}`"
      >
        <span class="account-stat__label">{{ item.label }}</span>
        <strong
          class="account-stat__value"
          :class="`account-stat__value--${item.tone ?? 'default'}`"
        >
          {{ item.value }}
        </strong>
      </div>
    </div>

    <div
      v-if="$slots.toolbar"
      class="account-data-toolbar"
    >
      <slot name="toolbar" />
    </div>
  </div>
</template>

<style scoped>
.account-data-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.account-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}

.account-stat {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-surface);
  box-shadow: var(--vtsuru-shadow-1, 0 1px 2px rgba(0, 0, 0, 0.03));
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.account-stat:hover {
  border-color: var(--vtsuru-border-hover, color-mix(in srgb, var(--vtsuru-fg) 20%, var(--vtsuru-border)));
}

.account-stat--primary {
  border-color: color-mix(in srgb, var(--vtsuru-primary) 32%, var(--vtsuru-border));
  background: color-mix(in srgb, var(--vtsuru-primary) 4%, var(--vtsuru-bg-surface));
}

.account-stat--success {
  border-color: color-mix(in srgb, var(--vtsuru-success) 32%, var(--vtsuru-border));
  background: color-mix(in srgb, var(--vtsuru-success) 4%, var(--vtsuru-bg-surface));
}

.account-stat--warning {
  border-color: color-mix(in srgb, var(--vtsuru-warning) 32%, var(--vtsuru-border));
  background: color-mix(in srgb, var(--vtsuru-warning) 4%, var(--vtsuru-bg-surface));
}

.account-stat--error {
  border-color: color-mix(in srgb, var(--vtsuru-error) 32%, var(--vtsuru-border));
  background: color-mix(in srgb, var(--vtsuru-error) 4%, var(--vtsuru-bg-surface));
}

.account-stat--info {
  border-color: color-mix(in srgb, var(--vtsuru-info) 32%, var(--vtsuru-border));
  background: color-mix(in srgb, var(--vtsuru-info) 4%, var(--vtsuru-bg-surface));
}

.account-stat__label {
  display: block;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-stat__value {
  display: block;
  margin-top: 4px;
  color: var(--vtsuru-fg);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-stat__value--primary {
  color: var(--vtsuru-primary);
}

.account-stat__value--success {
  color: var(--vtsuru-success);
}

.account-stat__value--warning {
  color: var(--vtsuru-warning);
}

.account-stat__value--error {
  color: var(--vtsuru-error);
}

.account-stat__value--info {
  color: var(--vtsuru-info);
}

.account-data-toolbar {
  padding: 10px 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-surface);
  box-shadow: var(--vtsuru-shadow-1, 0 1px 2px rgba(0, 0, 0, 0.03));
}

@media (max-width: 640px) {
  .account-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .account-stat {
    padding: 10px 12px;
  }

  .account-stat__value {
    font-size: 18px;
  }
}
</style>
