<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import type { FontBrowserEntry } from '@/apps/user-page/googleFonts'
import {
  FONT_CATEGORY_LABELS,
  getGoogleFontScriptBadge,
  resolveFontFamilyCss,
  useGoogleFont,
} from '@/apps/user-page/googleFonts'
import { Button } from '@/shared/ui/button'

export type { FontBrowserEntry }

const props = defineProps<{
  entry: FontBrowserEntry
  active: boolean
  applied: boolean
  loadPreview: boolean
}>()

const emit = defineEmits<{
  select: [value: string]
  apply: [value: string]
}>()

const previewedFamily = ref<string | null>(null)
watch(
  [() => props.entry.value, () => props.entry.source, () => props.loadPreview],
  ([value, source, loadPreview]) => {
    if (source !== 'google') {
      previewedFamily.value = null
      return
    }
    if (loadPreview) previewedFamily.value = value
    else if (previewedFamily.value !== value) previewedFamily.value = null
  },
  { immediate: true },
)

const fontFamily = computed(() => previewedFamily.value ?? undefined)
useGoogleFont(fontFamily)

const fontStyle = computed(() => {
  if (props.entry.source === 'system') {
    return { fontFamily: resolveFontFamilyCss(props.entry.value) }
  }
  return previewedFamily.value ? { fontFamily: resolveFontFamilyCss(props.entry.value) } : undefined
})

const scriptBadge = computed(() => {
  if (props.entry.source === 'system') return '系统'
  return props.entry.subsets ? getGoogleFontScriptBadge({ subsets: props.entry.subsets }) : null
})

const cjkSample = computed(() => {
  if (props.entry.source === 'system') return ''
  if (scriptBadge.value === '中文') return '春风又绿'
  if (scriptBadge.value === '日文') return 'あいう漢字'
  return ''
})

const categoryLabel = computed(() =>
  props.entry.category ? (FONT_CATEGORY_LABELS[props.entry.category] ?? props.entry.category) : '',
)
</script>

<template>
  <Button
    variant="ghost"
    size="none"
    class="w-full h-[46px] px-2.5 border-0 border-b border-border/60 rounded-none flex-between gap-2 text-left font-normal transition-colors"
    :class="active ? 'bg-brand-soft text-brand hover:bg-brand-soft' : 'hover:bg-accent/60'"
    @click="emit('select', entry.value)"
    @dblclick="emit('apply', entry.value)"
  >
    <div class="min-w-0 flex-1 flex items-baseline gap-2">
      <span
        class="truncate text-[15px] leading-snug"
        :style="fontStyle"
      >
        {{ entry.label }}
      </span>
      <span
        v-if="cjkSample"
        class="shrink-0 text-sm text-muted-foreground"
        :style="fontStyle"
      >
        {{ cjkSample }}
      </span>
    </div>

    <div class="shrink-0 flex items-center gap-1.5">
      <span
        v-if="scriptBadge"
        class="px-1.5 py-0.5 rounded-sm text-[10px] leading-none font-medium"
        :class="
          scriptBadge === '中文'
            ? 'bg-brand-soft text-brand'
            : scriptBadge === '系统'
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-muted text-muted-foreground'
        "
      >
        {{ scriptBadge }}
      </span>
      <span
        v-if="categoryLabel"
        class="text-[11px] text-muted-foreground w-9 text-right"
      >
        {{ categoryLabel }}
      </span>
      <Check
        v-if="applied"
        class="size-3.5 text-brand shrink-0"
      />
    </div>
  </Button>
</template>
