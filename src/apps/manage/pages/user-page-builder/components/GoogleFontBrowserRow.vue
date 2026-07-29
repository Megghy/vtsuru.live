<script setup lang="ts">
import type { GoogleFontCatalogItem } from '@/apps/user-page/googleFonts'
import { computed } from 'vue'
import { getGoogleFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

const props = defineProps<{
  font: GoogleFontCatalogItem
  active: boolean
  categoryLabel: string
}>()

const emit = defineEmits<{
  select: [family: string]
}>()

const fontFamily = computed(() => props.font.family)
const fontStyle = computed(() => ({ fontFamily: getGoogleFontFamilyCss(props.font.family) }))
useGoogleFont(fontFamily)
</script>

<template>
  <button
    type="button"
    class="font-row"
    :class="{ active }"
    @click="emit('select', font.family)"
  >
    <span class="font-row__name" :style="fontStyle">{{ font.family }}</span>
    <span class="font-row__category">{{ categoryLabel }}</span>
  </button>
</template>

<style scoped>
.font-row {
  width: 100%;
  height: 46px;
  padding: 0 10px;
  border: 0;
  border-bottom: 1px solid var(--vtsuru-border);
  background: transparent;
  color: var(--vtsuru-fg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
  cursor: pointer;
}

.font-row:hover,
.font-row.active {
  background: var(--vtsuru-brand-soft);
}

.font-row.active {
  color: var(--vtsuru-brand);
}

.font-row__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
}

.font-row__category {
  flex: 0 0 auto;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
</style>
