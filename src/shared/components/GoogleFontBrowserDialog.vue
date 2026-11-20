<script setup lang="ts">
import { useEventListener, useVirtualList } from '@vueuse/core'
import { RotateCcw, Search, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { FontBrowserEntry, FontPickerOption, FontScriptFilter } from '@/apps/user-page/googleFonts'
import {
  FONT_CATEGORY_LABELS,
  buildFontBrowserEntries,
  filterFontBrowserEntries,
  getGoogleFontScriptBadge,
  googleFontsCatalog,
  googleFontsCatalogError,
  googleFontsCatalogLoading,
  isChineseGoogleFont,
  isJapaneseGoogleFont,
  loadGoogleFontsCatalog,
  recentFontFamilies,
  resolveFontFamilyCss,
  useGoogleFont,
} from '@/apps/user-page/googleFonts'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import GoogleFontBrowserRow from './GoogleFontBrowserRow.vue'

const DEFAULT_SAMPLE_TEXT = '春风又绿江南岸\nThe quick brown fox jumps over the lazy dog\n0123456789'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    modelValue: string | null
    clearable?: boolean
    extraOptions?: readonly FontPickerOption[]
  }>(),
  {
    clearable: true,
    extraOptions: () => [],
  },
)

const emit = defineEmits<{
  apply: [value: string | null]
}>()

const fontSearch = ref('')
const fontScript = ref<FontScriptFilter>('all')
const fontCategory = ref<string | null>(null)
const previewValue = ref<string | null>(null)
const sampleText = ref(DEFAULT_SAMPLE_TEXT)
const previewWeight = ref<'400' | '700'>('400')
const previewSize = ref<'sm' | 'md' | 'lg'>('md')

const allEntries = computed<FontBrowserEntry[]>(() =>
  buildFontBrowserEntries(props.extraOptions, googleFontsCatalog.value, props.modelValue),
)

const scriptCounts = computed(() => {
  let zh = 0
  let ja = 0
  let system = 0
  for (const entry of allEntries.value) {
    if (entry.source === 'system') system++
    else if (entry.subsets) {
      if (isChineseGoogleFont({ subsets: entry.subsets })) zh++
      if (isJapaneseGoogleFont({ subsets: entry.subsets })) ja++
    }
  }
  const byVal = new Set(allEntries.value.map((e) => e.value))
  const recent = recentFontFamilies.value.filter((v) => byVal.has(v)).length
  return { all: allEntries.value.length, zh, ja, system, recent }
})

const fontCategoryOptions = computed(() =>
  [...new Set(googleFontsCatalog.value.map((font) => font.category))]
    .toSorted((a, b) => (FONT_CATEGORY_LABELS[a] ?? a).localeCompare(FONT_CATEGORY_LABELS[b] ?? b))
    .map((category) => ({ label: FONT_CATEGORY_LABELS[category] ?? category, value: category })),
)

const filteredEntries = computed(() =>
  filterFontBrowserEntries(allEntries.value, {
    query: fontSearch.value,
    script: fontScript.value,
    category: fontCategory.value,
    recent: recentFontFamilies.value,
  }),
)

const hasActiveFilter = computed(
  () => Boolean(fontSearch.value.trim()) || fontScript.value !== 'all' || fontCategory.value !== null,
)

const {
  list: virtualEntries,
  containerProps: virtualContainerProps,
  wrapperProps: virtualWrapperProps,
  scrollTo: scrollBrowserTo,
} = useVirtualList(filteredEntries, {
  itemHeight: 46,
  overscan: 6,
})

const rowPreviewEnabled = ref(true)
let scrollIdleTimer: ReturnType<typeof setTimeout> | undefined
let pointerActive = false

function handleScroll() {
  rowPreviewEnabled.value = false
  clearTimeout(scrollIdleTimer)
  if (pointerActive) return
  scrollIdleTimer = setTimeout(() => {
    rowPreviewEnabled.value = true
  }, 180)
}

function handlePointerDown() {
  pointerActive = true
  rowPreviewEnabled.value = false
  clearTimeout(scrollIdleTimer)
}

function handlePointerEnd() {
  if (!pointerActive) return
  pointerActive = false
  handleScroll()
}

useEventListener(window, ['pointerup', 'pointercancel'], handlePointerEnd)
onBeforeUnmount(() => clearTimeout(scrollIdleTimer))

watch([fontSearch, fontScript, fontCategory], () => {
  scrollBrowserTo(0)
})

const activeEntry = computed<FontBrowserEntry | null>(() => {
  const target = previewValue.value ?? props.modelValue
  if (target) {
    const found = allEntries.value.find((e) => e.value === target)
    if (found) return found
  }
  return filteredEntries.value[0] ?? null
})

const previewLoadFamily = computed(() => {
  if (!open.value || !activeEntry.value || activeEntry.value.source !== 'google') return undefined
  return activeEntry.value.value
})
useGoogleFont(previewLoadFamily)

const previewSizePx = computed(() => (previewSize.value === 'sm' ? '14px' : previewSize.value === 'lg' ? '26px' : '18px'))

const previewStyle = computed(() => ({
  fontFamily: resolveFontFamilyCss(activeEntry.value?.value),
  fontWeight: Number(previewWeight.value),
  fontSize: previewSizePx.value,
}))

const activeScriptBadge = computed(() => {
  if (!activeEntry.value) return null
  if (activeEntry.value.source === 'system') return '系统字体'
  return activeEntry.value.subsets ? getGoogleFontScriptBadge({ subsets: activeEntry.value.subsets }) : null
})

watch(open, (isOpen) => {
  if (!isOpen) return
  previewValue.value = props.modelValue
  rowPreviewEnabled.value = true
  void loadGoogleFontsCatalog()
    .catch((error) => console.error('Google Fonts 字体目录加载失败', error))
    .finally(() => {
      void nextTick(() => {
        if (!open.value) return
        const idx = props.modelValue ? filteredEntries.value.findIndex((e) => e.value === props.modelValue) : -1
        scrollBrowserTo(idx >= 0 ? Math.max(0, idx - 2) : 0)
      })
    })
})

function resetFilters() {
  fontSearch.value = ''
  fontScript.value = 'all'
  fontCategory.value = null
}

function applyEntry(value: string | null) {
  emit('apply', value)
  open.value = false
}

function onScriptChange(val: unknown) {
  if (typeof val === 'string' && ['all', 'zh', 'ja', 'system', 'recent'].includes(val)) {
    fontScript.value = val as FontScriptFilter
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-3xl max-h-[86vh] flex flex-col p-4 gap-3">
      <DialogHeader class="pb-2 border-b border-border/60">
        <div class="flex-between pr-6 gap-2">
          <DialogTitle class="text-sm flex items-center gap-2">
            <span>字体库</span>
            <Badge
              v-if="filteredEntries.length"
              variant="secondary"
              class="font-normal tabular-nums"
            >
              共 {{ filteredEntries.length }} 款
            </Badge>
          </DialogTitle>
          <Button
            v-if="hasActiveFilter"
            variant="ghost"
            size="xs"
            @click="resetFilters"
          >
            <RotateCcw class="size-3" />
            <span>重置筛选</span>
          </Button>
        </div>
      </DialogHeader>

      <!-- 搜索 + 分类 + 语言筛选 -->
      <div class="space-y-2 shrink-0">
        <div class="flex items-center gap-2">
          <div class="relative flex-1 min-w-0">
            <Search class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              v-model="fontSearch"
              placeholder="搜索字体名称（支持英文 / 拼音关键字）..."
              class="pl-8 pr-7"
            />
            <Button
              v-if="fontSearch"
              variant="ghost"
              size="none"
              class="size-5 rounded flex-center absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="清空搜索"
              @click="fontSearch = ''"
            >
              <X class="size-3" />
            </Button>
          </div>

          <Select
            :model-value="fontCategory ?? 'all'"
            @update:model-value="fontCategory = $event === 'all' ? null : String($event)"
          >
            <SelectTrigger class="w-32 shrink-0">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              <SelectItem
                v-for="cat in fontCategoryOptions"
                :key="cat.value"
                :value="cat.value"
              >
                {{ cat.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ToggleGroup
          :model-value="fontScript"
          type="single"
          size="xs"
          class="flex flex-wrap justify-start"
          @update:model-value="onScriptChange"
        >
          <ToggleGroupItem value="all">
            全部 ({{ scriptCounts.all }})
          </ToggleGroupItem>
          <ToggleGroupItem value="zh">
            中文 ({{ scriptCounts.zh }})
          </ToggleGroupItem>
          <ToggleGroupItem value="ja">
            日文 ({{ scriptCounts.ja }})
          </ToggleGroupItem>
          <ToggleGroupItem
            v-if="scriptCounts.system > 0"
            value="system"
          >
            系统 ({{ scriptCounts.system }})
          </ToggleGroupItem>
          <ToggleGroupItem
            v-if="scriptCounts.recent > 0"
            value="recent"
          >
            最近 ({{ scriptCounts.recent }})
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <span
        v-if="googleFontsCatalogError"
        class="text-destructive text-xs shrink-0"
      >
        {{ googleFontsCatalogError }}
      </span>

      <!-- 主体：左虚拟列表 + 右实时预览 -->
      <div class="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-3 flex-1 min-h-0 overflow-hidden">
        <div
          v-if="filteredEntries.length"
          v-bind="virtualContainerProps"
          class="h-[400px] overflow-y-auto scrollbar-thin border border-border rounded-lg bg-background"
          @pointerdown.capture="handlePointerDown"
          @scroll="handleScroll"
        >
          <div v-bind="virtualWrapperProps">
            <GoogleFontBrowserRow
              v-for="{ data: item } in virtualEntries"
              :key="item.value"
              :entry="item"
              :active="activeEntry?.value === item.value"
              :applied="modelValue === item.value"
              :load-preview="rowPreviewEnabled"
              @select="previewValue = $event"
              @apply="applyEntry($event)"
            />
          </div>
        </div>
        <div
          v-else-if="googleFontsCatalogLoading"
          class="h-[400px] border border-border rounded-lg flex-center"
        >
          <Spin />
        </div>
        <Empty
          v-else
          class="h-[400px] border border-border rounded-lg flex-center"
          description="未找到匹配的字体"
        />

        <!-- 右侧预览面板 -->
        <section
          v-if="activeEntry"
          class="p-3 rounded-lg border border-border bg-muted/20 flex flex-col justify-between gap-3 min-w-0"
        >
          <div class="space-y-2.5 flex-1 flex flex-col min-h-0">
            <div class="space-y-1">
              <div class="text-sm font-semibold text-foreground truncate" :title="activeEntry.label">
                {{ activeEntry.label }}
              </div>
              <div class="flex flex-wrap items-center gap-1">
                <Badge
                  v-if="activeScriptBadge"
                  :variant="activeScriptBadge === '中文' ? 'default' : 'secondary'"
                  class="text-[10px] px-1.5 py-0"
                >
                  {{ activeScriptBadge }}
                </Badge>
                <Badge
                  v-if="activeEntry.category"
                  variant="outline"
                  class="text-[10px] px-1.5 py-0"
                >
                  {{ FONT_CATEGORY_LABELS[activeEntry.category] ?? activeEntry.category }}
                </Badge>
                <Badge
                  v-if="activeEntry.variable"
                  variant="outline"
                  class="text-[10px] px-1.5 py-0"
                >
                  可变字重
                </Badge>
                <span
                  v-else-if="activeEntry.weights?.length"
                  class="text-[11px] text-muted-foreground"
                >
                  {{ activeEntry.weights.length }} 种字重
                </span>
              </div>
            </div>

            <!-- 预览字重 / 字号调节 -->
            <div class="flex-between gap-2">
              <ToggleGroup
                :model-value="previewWeight"
                type="single"
                size="xs"
                @update:model-value="(v) => { if (v === '400' || v === '700') previewWeight = v }"
              >
                <ToggleGroupItem value="400">常规</ToggleGroupItem>
                <ToggleGroupItem value="700">粗体</ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup
                :model-value="previewSize"
                type="single"
                size="xs"
                @update:model-value="(v) => { if (v === 'sm' || v === 'md' || v === 'lg') previewSize = v }"
              >
                <ToggleGroupItem value="sm">小</ToggleGroupItem>
                <ToggleGroupItem value="md">中</ToggleGroupItem>
                <ToggleGroupItem value="lg">大</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <!-- 可直接编辑的实时预览框 -->
            <div class="relative flex-1 min-h-[160px] flex flex-col">
              <Textarea
                v-model="sampleText"
                class="w-full flex-1 resize-none bg-background p-3 leading-relaxed scrollbar-thin"
                :style="previewStyle"
                placeholder="输入任意预览文字..."
              />
              <Button
                v-if="sampleText !== DEFAULT_SAMPLE_TEXT"
                variant="ghost"
                size="none"
                class="size-6 rounded flex-center absolute right-1.5 bottom-1.5 text-muted-foreground hover:text-foreground bg-background/80"
                title="恢复默认示例文字"
                @click="sampleText = DEFAULT_SAMPLE_TEXT"
              >
                <RotateCcw class="size-3" />
              </Button>
            </div>
            <p class="text-[11px] text-muted-foreground">
              可直接修改上方文字预览效果，双击左侧列表项可快速应用
            </p>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <Button
              v-if="clearable && modelValue"
              variant="outline"
              @click="applyEntry(null)"
            >
              恢复默认
            </Button>
            <Button
              class="flex-1"
              :disabled="modelValue === activeEntry.value"
              @click="applyEntry(activeEntry.value)"
            >
              {{ modelValue === activeEntry.value ? '正在使用' : '使用此字体' }}
            </Button>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
