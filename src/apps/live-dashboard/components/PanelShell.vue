<script setup lang="ts">
defineProps<{ title: string; count?: number; unread?: number; blurred?: boolean }>()
defineSlots<{ actions?: () => unknown; default: () => unknown }>()
</script>

<template>
  <section
    class="panel"
    :class="{ 'panel--blurred': blurred }"
  >
    <header class="panel__head">
      <span class="panel__title">{{ title }}</span>
      <span
        v-if="count !== undefined"
        class="panel__count"
      >{{ count }}</span>
      <span
        v-if="unread"
        class="panel__unread"
        title="未读"
      >{{ unread }}</span>
      <div class="panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--vtsuru-bg);
}

.panel--blurred {
  filter: blur(6px) grayscale(0.6);
  opacity: 0.5;
  pointer-events: none;
}

.panel__head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 8px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  border-bottom: 1px solid var(--vtsuru-border);
}

.panel__title {
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.panel__count {
  font-variant-numeric: tabular-nums;
}

.panel__unread {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--vtsuru-brand-soft);
  color: var(--vtsuru-brand);
  font-variant-numeric: tabular-nums;
}

.panel__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
}

.panel__body {
  flex: 1;
  min-height: 0;
}
</style>
