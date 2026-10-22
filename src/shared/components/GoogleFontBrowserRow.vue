<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { GoogleFontCatalogItem } from '@/apps/user-page/googleFonts'
import { getGoogleFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

const props = defineProps<{
  font: GoogleFontCatalogItem
  active: boolean
  categoryLabel: string
  loadPreview: boolean
}>()

const emit = defineEmits<{
  select: [family: string]
}>()

const previewedFamily = ref<string | null>(null)
watch(
  [() => props.font.family, () => props.loadPreview],
  ([family, loadPreview]) => {
    if (loadPreview) previewedFamily.value = family
    else if (previewedFamily.value !== family) previewedFamily.value = null
  },
  { immediate: true },
)
const fontFamily = computed(() => previewedFamily.value ?? undefined)
const fontStyle = computed(() =>
  previewedFamily.value ? { fontFamily: getGoogleFontFamilyCss(props.font.family) } : undefined,
)
useGoogleFont(fontFamily)
</script>

<template>
  <button
    type="button"
    class="w-full h-[46px] px-2.5 border-0 border-b border-border bg-transparent text-foreground flex-between gap-3 text-left cursor-pointer hover:bg-[var(--brand-soft)]"
    :class="{ 'bg-[var(--brand-soft)] text-[var(--brand)]': active }"
    @click="emit('select', font.family)"
  >
    <span
      class="truncate text-[17px]"
      :style="fontStyle"
      >{{ font.family }}</span
    >
    <span class="shrink-0 text-muted-foreground text-xs">{{ categoryLabel }}</span>
  </button>
</template>
