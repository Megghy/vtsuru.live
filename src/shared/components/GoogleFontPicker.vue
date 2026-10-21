<script setup lang="ts">
import { TextFont24Regular } from '@vicons/fluent'
import { SearchOutline } from '@vicons/ionicons5'
import { computed, ref } from 'vue'

import {
  getGoogleFontFamilyCss,
  googleFontsCatalog,
  googleFontsCatalogError,
  googleFontsCatalogLoading,
  loadGoogleFontsCatalog,
  useGoogleFont,
} from '@/apps/user-page/googleFonts'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import GoogleFontBrowserRow from './GoogleFontBrowserRow.vue'

export interface GoogleFontPickerOption {
  label: string
  value: string
}

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

const fontOptions = computed(() => {
  const seen = new Set<string>()
  const options: GoogleFontPickerOption[] = []
  for (const option of props.extraOptions) {
    if (seen.has(option.value)) continue
    seen.add(option.value)
    options.push(option)
  }
  for (const font of googleFontsCatalog.value) {
    if (seen.has(font.family)) continue
    seen.add(font.family)
    options.push({ label: font.family, value: font.family })
  }
  const selected = model.value
  if (selected && !seen.has(selected)) options.unshift({ label: selected, value: selected })
  return options
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

const selectedFontStyle = computed(() => ({ fontFamily: getGoogleFontFamilyCss(model.value) }))
const fontBrowserShown = ref(false)
const fontSearch = ref('')
const fontCategory = ref<string | null>(null)
const fontPreviewFamily = ref<string | null>(null)

const fontCategoryLabels: Record<string, string> = {
  'sans-serif': '无衬线',
  serif: '衬线',
  display: '展示',
  handwriting: '手写',
  monospace: '等宽',
}
const fontCategoryOptions = computed(() =>
  [...new Set(googleFontsCatalog.value.map((font) => font.category))]
    .toSorted((a, b) => (fontCategoryLabels[a] ?? a).localeCompare(fontCategoryLabels[b] ?? b))
    .map((category) => ({ label: fontCategoryLabels[category] ?? category, value: category })),
)
const browsableFonts = computed(() => {
  const query = fontSearch.value.trim().toLocaleLowerCase()
  return googleFontsCatalog.value.filter(
    (font) =>
      (!fontCategory.value || font.category === fontCategory.value) &&
      (!query || font.family.toLocaleLowerCase().includes(query)),
  )
})
const activePreviewFamily = computed(
  () => fontPreviewFamily.value ?? model.value ?? browsableFonts.value[0]?.family ?? null,
)
const browserPreviewStyle = computed(() => ({ fontFamily: getGoogleFontFamilyCss(activePreviewFamily.value) }))

const browserLoadFamily = computed(() => {
  if (!fontBrowserShown.value) return undefined
  const family = activePreviewFamily.value
  if (!family) return undefined
  if (!googleFontsCatalog.value.some((font) => font.family === family)) return undefined
  return family
})

useGoogleFont(selectedLoadFamily)
useGoogleFont(browserLoadFamily)

function loadFontCatalog() {
  void loadGoogleFontsCatalog().catch((error) => console.error('Google Fonts 字体目录加载失败', error))
}

function openFontBrowser() {
  fontPreviewFamily.value = model.value
  fontBrowserShown.value = true
  loadFontCatalog()
}

function applyPreviewFont() {
  if (!activePreviewFamily.value) return
  model.value = activePreviewFamily.value
  fontBrowserShown.value = false
}
</script>

<template>
  <TooltipProvider>
    <div class="google-font-picker w-full">
      <div class="font-field grid gap-2 w-full">
        <div class="font-picker flex items-center gap-1.5">
          <Select
            :model-value="model ?? ''"
            @update:model-value="model = $event ? String($event) : null"
          >
            <SelectTrigger class="h-8 text-xs flex-1">
              <SelectValue :placeholder="placeholder" />
            </SelectTrigger>
            <SelectContent class="max-h-60">
              <SelectItem
                v-if="clearable"
                value=""
                class="text-xs text-muted-foreground"
              >
                默认字体
              </SelectItem>
              <SelectItem
                v-for="opt in fontOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="size-8 shrink-0"
                aria-label="浏览字体库"
                @click="openFontBrowser"
              >
                <component :is="TextFont24Regular" class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>浏览字体库</TooltipContent>
          </Tooltip>
        </div>

        <div
          v-if="showPreview && model"
          class="font-preview p-2 rounded-md border border-border bg-muted/20 text-foreground text-sm"
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

      <Dialog v-model:open="fontBrowserShown">
        <DialogContent class="sm:max-w-2xl max-h-[85vh] flex flex-col p-4 gap-3">
          <DialogHeader class="pb-2 border-b border-border/60">
            <DialogTitle class="text-sm font-semibold">Google Fonts 字体库</DialogTitle>
          </DialogHeader>

          <div class="font-browser-controls flex items-center gap-2">
            <div class="relative flex-1">
              <component :is="SearchOutline" class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                v-model="fontSearch"
                placeholder="搜索字体名称..."
                class="h-8 pl-8 text-xs"
              />
            </div>

            <Select
              :model-value="fontCategory ?? 'all'"
              @update:model-value="fontCategory = $event === 'all' ? null : String($event)"
            >
              <SelectTrigger class="w-36 h-8 text-xs shrink-0">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" class="text-xs">全部分类</SelectItem>
                <SelectItem
                  v-for="cat in fontCategoryOptions"
                  :key="cat.value"
                  :value="cat.value"
                  class="text-xs"
                >
                  {{ cat.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <span
            v-if="googleFontsCatalogError"
            class="text-destructive text-xs"
          >
            {{ googleFontsCatalogError }}
          </span>

          <div class="font-browser-body grid grid-cols-1 md:grid-cols-[1fr_260px] gap-3 flex-1 min-h-0 overflow-hidden">
            <ScrollArea class="h-80 border border-border/80 rounded-lg p-1">
              <div v-if="browsableFonts.length" class="space-y-1">
                <GoogleFontBrowserRow
                  v-for="item in browsableFonts.slice(0, 150)"
                  :key="item.family"
                  :font="item"
                  :active="activePreviewFamily === item.family"
                  :category-label="fontCategoryLabels[item.category] ?? item.category"
                  :load-preview="true"
                  @select="fontPreviewFamily = $event"
                />
              </div>
              <div
                v-else-if="googleFontsCatalogLoading"
                class="py-16 flex justify-center"
              >
                <Spin />
              </div>
              <Empty
                v-else
                class="py-12"
                description="未找到匹配的字体"
              />
            </ScrollArea>

            <section
              v-if="activePreviewFamily"
              class="font-browser-preview p-3 rounded-lg border border-border/80 bg-muted/20 flex flex-col justify-between gap-3 text-xs"
            >
              <div class="space-y-2">
                <span class="text-xs font-semibold text-foreground block">
                  {{ activePreviewFamily }}
                </span>
                <div
                  class="font-browser-preview__sample p-3 rounded bg-background border border-border/60 text-sm leading-relaxed"
                  :style="browserPreviewStyle"
                >
                  春风又绿江南岸<br />
                  The quick brown fox<br />
                  0123456789
                </div>
              </div>

              <Button
                size="sm"
                class="w-full text-xs"
                :disabled="model === activePreviewFamily"
                @click="applyPreviewFont"
              >
                {{ model === activePreviewFamily ? '正在使用' : '使用此字体' }}
              </Button>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </TooltipProvider>
</template>
