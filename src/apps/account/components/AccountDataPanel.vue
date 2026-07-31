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

    <div class="account-data-toolbar">
      <slot name="toolbar" />
    </div>
  </div>
</template>

<style scoped>
.account-data-panel {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}

.account-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 8px;
}

.account-stat {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-surface);
}

.account-stat__label {
  display: block;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  line-height: 1.4;
}

.account-stat__value {
  display: block;
  margin-top: 3px;
  color: var(--vtsuru-fg);
  font-size: 21px;
  line-height: 1.3;
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
  padding: 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-surface);
}

@media (max-width: 768px) {
  .account-stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .account-stat {
    padding: 10px 12px;
  }

  .account-stat__value {
    font-size: 19px;
  }
}
</style>
