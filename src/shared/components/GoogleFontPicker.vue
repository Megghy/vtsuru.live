<script setup lang="ts">
import { useVirtualList } from '@vueuse/core'
import { Check, ChevronsUpDown, ExternalLink, Search, Type, X } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'

import type { FontBrowserEntry, FontPickerOption, FontScriptFilter } from '@/apps/user-page/googleFonts'
import {
  buildFontBrowserEntries,
  filterFontBrowserEntries,
  getGoogleFontScriptBadge,
  googleFontsCatalog,
  googleFontsCatalogError,
  googleFontsCatalogLoading,
  loadGoogleFontsCatalog,
  recentFontFamilies,
  recordRecentFont,
  resolveFontFamilyCss,
  useGoogleFont,
} from '@/apps/user-page/googleFonts'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import GoogleFontBrowserDialog from './GoogleFontBrowserDialog.vue'

export type GoogleFontPickerOption = FontPickerOption

const model = defineModel<string | null>({ default: null })

const props = withDefaults(
  defineProps<{
    placeholder?: string
    clearable?: boolean
    showPreview?: boolean
    extraOptions?: GoogleFontPickerOption[]
  }>(),
  {
    placeholder: '选择字体',
    clearable: true,
    showPreview: true,
    extraOptions: () => [],
  },
)

const popoverOpen = ref(false)
const dialogOpen = ref(false)
const quickSearch = ref('')
const quickScript = ref<FontScriptFilter>('all')
const highlightedIndex = ref(0)
const searchInputRef = ref<{ $el?: HTMLElement } | null>(null)

const allEntries = computed<FontBrowserEntry[]>(() =>
  buildFontBrowserEntries(props.extraOptions, googleFontsCatalog.value, model.value),
)

const hasSystemOptions = computed(() => allEntries.value.some((e) => e.source === 'system'))
const hasRecentOptions = computed(() => {
  const known = new Set(allEntries.value.map((e) => e.value))
  return recentFontFamilies.value.some((v) => known.has(v))
})

const filteredPopoverEntries = computed(() =>
  filterFontBrowserEntries(allEntries.value, {
    query: quickSearch.value,
    script: quickScript.value,
    recent: recentFontFamilies.value,
  }),
)

const showDefaultRow = computed(() => props.clearable && !quickSearch.value.trim() && quickScript.value === 'all')

const {
  list: virtualPopoverItems,
  containerProps: popoverListContainerProps,
  wrapperProps: popoverListWrapperProps,
  scrollTo: scrollPopoverTo,
} = useVirtualList(filteredPopoverEntries, {
  itemHeight: 34,
  overscan: 6,
})

const selectedLabel = computed(() => {
  if (!model.value) return ''
  return allEntries.value.find((e) => e.value === model.value)?.label ?? model.value
})

const localOnlyFonts = computed(() => new Set(props.extraOptions.map((option) => option.value)))
const selectedLoadFamily = computed(() => {
  const selected = model.value
  if (!selected) return undefined
  if (localOnlyFonts.value.has(selected) && !googleFontsCatalog.value.some((font) => font.family === selected)) {
    return undefined
  }
  return selected
})

useGoogleFont(selectedLoadFamily)

const selectedFontStyle = computed(() => ({ fontFamily: resolveFontFamilyCss(model.value) }))

function ensureCatalogLoaded() {
  return loadGoogleFontsCatalog().catch((error) => console.error('Google Fonts 字体目录加载失败', error))
}

function selectFont(value: string | null) {
  model.value = value
  if (value) recordRecentFont(value)
  popoverOpen.value = false
}

function openFontBrowser() {
  popoverOpen.value = false
  dialogOpen.value = true
}

function getEntryBadge(entry: FontBrowserEntry): string | null {
  if (entry.source === 'system') return '系统'
  return entry.subsets ? getGoogleFontScriptBadge({ subsets: entry.subsets }) : null
}

function handleSearchKeydown(e: KeyboardEvent) {
  const total = filteredPopoverEntries.value.length
  if (total === 0) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = (highlightedIndex.value + 1) % total
    scrollPopoverTo(Math.max(0, highlightedIndex.value - 3))
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = (highlightedIndex.value - 1 + total) % total
    scrollPopoverTo(Math.max(0, highlightedIndex.value - 3))
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const entry = filteredPopoverEntries.value[highlightedIndex.value]
    if (entry) selectFont(entry.value)
  }
}

watch([quickSearch, quickScript], () => {
  highlightedIndex.value = 0
  scrollPopoverTo(0)
})

watch(popoverOpen, (open) => {
  if (!open) return
  quickSearch.value = ''
  highlightedIndex.value = 0
  void ensureCatalogLoaded().finally(() => {
    void nextTick(() => {
      if (!popoverOpen.value) return
      const inputEl = searchInputRef.value?.$el?.querySelector('input') ?? searchInputRef.value?.$el
      if (inputEl instanceof HTMLInputElement) inputEl.focus()
      const idx = model.value ? filteredPopoverEntries.value.findIndex((e) => e.value === model.value) : -1
      if (idx >= 0) {
        highlightedIndex.value = idx
        scrollPopoverTo(Math.max(0, idx - 2))
      } else {
        scrollPopoverTo(0)
      }
    })
  })
})

const quickFilterTabs = computed<{ value: FontScriptFilter; label: string }[]>(() => {
  const tabs: { value: FontScriptFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日文' },
  ]
  if (hasSystemOptions.value) tabs.push({ value: 'system', label: '系统' })
  if (hasRecentOptions.value) tabs.push({ value: 'recent', label: '最近' })
  return tabs
})
</script>

<template>
  <TooltipProvider>
    <div class="google-font-picker w-full">
      <div class="grid gap-2 w-full">
        <div class="flex items-center gap-1.5">
          <Popover v-model:open="popoverOpen">
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                role="combobox"
                :aria-expanded="popoverOpen"
                class="flex-1 min-w-0 justify-between px-2.5 font-normal bg-control hover:bg-control/80"
              >
                <span
                  v-if="selectedLabel"
                  class="truncate text-left text-foreground"
                  :style="selectedFontStyle"
                >
                  {{ selectedLabel }}
                </span>
                <span
                  v-else
                  class="truncate text-left text-muted-foreground"
                >
                  {{ placeholder }}
                </span>

                <span class="flex items-center gap-0.5 shrink-0 ml-1">
                  <span
                    v-if="clearable && model"
                    role="button"
                    tabindex="-1"
                    class="size-4 rounded-sm flex-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="恢复默认字体"
                    @click.stop="selectFont(null)"
                  >
                    <X class="size-3" />
                  </span>
                  <ChevronsUpDown class="size-3.5 text-muted-foreground/80" />
                </span>
              </Button>
            </PopoverTrigger>

            <PopoverContent
              align="start"
              class="w-[296px] p-0 overflow-hidden"
            >
              <!-- 搜索框 -->
              <div class="flex items-center gap-1.5 px-2.5 py-1 border-b border-border">
                <Search class="size-3.5 shrink-0 text-muted-foreground" />
                <Input
                  ref="searchInputRef"
                  v-model="quickSearch"
                  placeholder="搜索字体名称..."
                  class="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
                  @keydown="handleSearchKeydown"
                />
                <Button
                  v-if="quickSearch"
                  variant="ghost"
                  size="none"
                  class="size-5 rounded flex-center text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="清空搜索"
                  @click="quickSearch = ''"
                >
                  <X class="size-3" />
                </Button>
              </div>

              <!-- 快捷语言/来源筛选 -->
              <div class="flex items-center gap-1 px-2 py-1.5 border-b border-border/60 bg-muted/25 overflow-x-auto no-scrollbar">
                <button
                  v-for="tab in quickFilterTabs"
                  :key="tab.value"
                  type="button"
                  class="px-2 py-0.5 rounded-sm text-[11px] font-medium shrink-0 transition-colors cursor-pointer"
                  :class="
                    quickScript === tab.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  "
                  @click="quickScript = tab.value"
                >
                  {{ tab.label }}
                </button>
              </div>

              <!-- 恢复默认行 -->
              <button
                v-if="showDefaultRow"
                type="button"
                class="w-full h-[34px] px-2.5 flex-between text-xs text-muted-foreground hover:bg-accent hover:text-foreground border-b border-border/50 transition-colors cursor-pointer"
                :class="!model ? 'bg-accent/50 text-foreground font-medium' : ''"
                @click="selectFont(null)"
              >
                <span>默认字体</span>
                <Check
                  v-if="!model"
                  class="size-3.5 text-brand"
                />
              </button>

              <!-- 虚拟滚动选项列表 -->
              <div
                v-if="filteredPopoverEntries.length"
                v-bind="popoverListContainerProps"
                class="h-60 overflow-y-auto scrollbar-thin"
              >
                <div v-bind="popoverListWrapperProps">
                  <button
                    v-for="{ data: entry, index } in virtualPopoverItems"
                    :key="entry.value"
                    type="button"
                    class="w-full h-[34px] px-2.5 flex-between gap-2 text-xs text-left transition-colors cursor-pointer"
                    :class="[
                      model === entry.value
                        ? 'bg-brand-soft text-brand font-medium'
                        : index === highlightedIndex
                          ? 'bg-accent text-foreground'
                          : 'text-foreground hover:bg-accent/70',
                    ]"
                    @mouseenter="highlightedIndex = index"
                    @click="selectFont(entry.value)"
                  >
                    <span
                      class="truncate flex-1 min-w-0"
                      :style="entry.source === 'system' || model === entry.value ? { fontFamily: resolveFontFamilyCss(entry.value) } : undefined"
                    >
                      {{ entry.label }}
                    </span>
                    <span class="flex items-center gap-1 shrink-0">
                      <span
                        v-if="getEntryBadge(entry)"
                        class="px-1 py-0.5 rounded-sm text-[10px] leading-none"
                        :class="
                          getEntryBadge(entry) === '中文'
                            ? 'bg-brand-soft text-brand'
                            : 'bg-muted text-muted-foreground'
                        "
                      >
                        {{ getEntryBadge(entry) }}
                      </span>
                      <Check
                        v-if="model === entry.value"
                        class="size-3.5 text-brand"
                      />
                    </span>
                  </button>
                </div>
              </div>
              <div
                v-else-if="googleFontsCatalogLoading"
                class="h-36 flex-center"
              >
                <Spin />
              </div>
              <Empty
                v-else
                size="small"
                class="py-8"
                description="未找到匹配的字体"
              />

              <!-- 底部状态栏 + 打开完整字体库 -->
              <div class="flex-between px-2.5 py-1.5 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
                <span class="tabular-nums">共 {{ filteredPopoverEntries.length }} 款</span>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-brand hover:underline cursor-pointer font-medium"
                  @click="openFontBrowser"
                >
                  <span>字体库预览</span>
                  <ExternalLink class="size-3" />
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon-sm"
                class="shrink-0"
                aria-label="浏览字体库"
                @click="openFontBrowser"
              >
                <Type class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>浏览字体库（实时预览）</TooltipContent>
          </Tooltip>
        </div>

        <div
          v-if="showPreview && model"
          class="p-2 rounded-md border border-border bg-muted/20 text-foreground text-sm truncate"
          :style="selectedFontStyle"
        >
          春风又绿江南岸 Aa 123
        </div>

        <span
          v-if="googleFontsCatalogError"
          class="text-destructive text-xs"
        >
          {{ googleFontsCatalogError }}
        </span>
      </div>

      <GoogleFontBrowserDialog
        v-model:open="dialogOpen"
        :model-value="model"
        :clearable="clearable"
        :extra-options="extraOptions"
        @apply="selectFont"
      />
    </div>
  </TooltipProvider>
</template>
