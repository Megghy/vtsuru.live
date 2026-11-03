<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { GoogleFontCatalogItem } from '@/apps/user-page/googleFonts'
import { getGoogleFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'
import { Button } from '@/shared/ui/button'

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
  <Button
    variant="ghost"
    class="w-full h-[46px] px-2.5 border-0 border-b border-border rounded-none flex-between gap-3 text-left font-normal"
    :class="{ 'bg-[var(--brand-soft)] text-[var(--brand)]': active }"
    @click="emit('select', font.family)"
  >
    <span
      class="truncate text-[17px]"
      :style="fontStyle"
    >
      {{ font.family }}
    </span>
    <span class="shrink-0 text-muted-foreground text-xs">{{ categoryLabel }}</span>
  </Button>
</template>
