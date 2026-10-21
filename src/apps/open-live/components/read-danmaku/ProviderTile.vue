<script setup lang="ts">
defineProps<{
  active: boolean
  title: string
  description?: string
  badge?: string
}>()
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <button
    type="button"
    class="provider-tile"
    :class="{ active }"
    @click="$emit('click')"
  >
    <div class="row">
      <span class="title">{{ title }}</span>
      <span
        v-if="badge"
        class="badge"
      >{{ badge }}</span>
    </div>
    <p
      v-if="description"
      class="desc"
    >
      {{ description }}
    </p>
  </button>
</template>

<style scoped>
.provider-tile {
  appearance: none;
  background: var(--vtsuru-bg, #fff);
  border: 1.5px solid var(--vtsuru-border, #e5e5e5);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition:
    border-color 120ms ease,
    background 120ms ease,
    box-shadow 120ms ease;
  min-height: 56px;
  width: 100%;
  font: inherit;
  color: inherit;
}
.provider-tile:hover {
  border-color: var(--vtsuru-brand, hsl(var(--primary)));
}
.provider-tile.active {
  border-color: var(--vtsuru-brand, hsl(var(--primary)));
  background: var(--vtsuru-brand-soft, rgba(56, 189, 248, 0.12));
  box-shadow: 0 0 0 1.5px var(--vtsuru-brand, hsl(var(--primary))) inset;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}
.badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--vtsuru-bg-muted);
  color: var(--vtsuru-fg-muted);
  border: 1px solid var(--vtsuru-border);
}
.desc {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  margin: 0;
  line-height: 1.4;
}
</style>
