<script setup lang="ts">
import { computed } from 'vue'
import { useThemeVars } from 'naive-ui'

defineProps<{
  active: boolean
  title: string
  description?: string
  badge?: string
}>()
defineEmits<{ (e: 'click'): void }>()

const themeVars = useThemeVars()
const activeColor = computed(() => themeVars.value.primaryColor)
const activeBg = computed(() => `${themeVars.value.primaryColor}14`)
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
      <span v-if="badge" class="badge">{{ badge }}</span>
    </div>
    <p v-if="description" class="desc">
      {{ description }}
    </p>
  </button>
</template>

<style scoped>
.provider-tile {
  appearance: none;
  background: var(--n-color, #fff);
  border: 1.5px solid var(--border-color, #e5e5e5);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
  min-height: 56px;
  width: 100%;
  font: inherit;
  color: inherit;
}
.provider-tile:hover {
  border-color: v-bind('activeColor');
}
.provider-tile.active {
  border-color: v-bind('activeColor');
  background: v-bind('activeBg');
  box-shadow: 0 0 0 1.5px v-bind('activeColor') inset;
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
  background: var(--n-color-target);
  color: var(--n-text-color-3);
  border: 1px solid var(--n-divider-color);
}
.desc {
  font-size: 11px;
  color: var(--n-text-color-3);
  margin: 0;
  line-height: 1.4;
}
</style>
