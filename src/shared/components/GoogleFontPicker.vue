<script setup lang="ts">
import { TextFont24Regular } from '@vicons/fluent'
import { SearchOutline } from '@vicons/ionicons5'
import { useEventListener } from '@vueuse/core'
import {
  NButton,
  NEmpty,
  NIcon,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NText,
  NTooltip,
  NVirtualList,
} from 'naive-ui'
import { computed, onBeforeUnmount, ref } from 'vue'

import {
  getGoogleFontFamilyCss,
  googleFontsCatalog,
  googleFontsCatalogError,
  googleFontsCatalogLoading,
  loadGoogleFontsCatalog,
  useGoogleFont,
} from '@/apps/user-page/googleFonts'

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
const fontRowPreviewEnabled = ref(true)
let fontScrollIdleTimer: ReturnType<typeof setTimeout> | undefined
let fontPointerActive = false

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

function loadFontCatalog(show = true) {
  if (!show) return
  void loadGoogleFontsCatalog().catch((error) => console.error('Google Fonts 字体目录加载失败', error))
}

function openFontBrowser() {
  fontPreviewFamily.value = model.value
  fontRowPreviewEnabled.value = true
  fontBrowserShown.value = true
  loadFontCatalog()
}

function handleFontBrowserScroll() {
  fontRowPreviewEnabled.value = false
  clearTimeout(fontScrollIdleTimer)
  if (fontPointerActive) return
  fontScrollIdleTimer = setTimeout(() => {
    fontRowPreviewEnabled.value = true
  }, 180)
}

function handleFontBrowserPointerDown() {
  fontPointerActive = true
  fontRowPreviewEnabled.value = false
  clearTimeout(fontScrollIdleTimer)
}

function handleFontBrowserPointerEnd() {
  if (!fontPointerActive) return
  fontPointerActive = false
  handleFontBrowserScroll()
}

useEventListener(window, ['pointerup', 'pointercancel'], handleFontBrowserPointerEnd)
onBeforeUnmount(() => clearTimeout(fontScrollIdleTimer))

function applyPreviewFont() {
  if (!activePreviewFamily.value) return
  model.value = activePreviewFamily.value
  fontBrowserShown.value = false
}
</script>

<template>
  <div class="google-font-picker">
    <div class="font-field">
      <div class="font-picker">
        <NSelect
          v-model:value="model"
          :options="fontOptions"
          :loading="googleFontsCatalogLoading"
          filterable
          :clearable="clearable"
          :placeholder="placeholder"
          @focus="loadFontCatalog()"
          @update:show="loadFontCatalog"
        />
        <NTooltip>
          <template #trigger>
            <NButton
              quaternary
              class="font-browser-button"
              aria-label="浏览字体库"
              @click="openFontBrowser"
            >
              <template #icon>
                <NIcon :component="TextFont24Regular" />
              </template>
            </NButton>
          </template>
          浏览字体库
        </NTooltip>
      </div>
      <div
        v-if="showPreview && model"
        class="font-preview"
        :style="selectedFontStyle"
      >
        春风又绿江南岸 Aa 123
      </div>
      <NText
        v-if="googleFontsCatalogError"
        type="error"
        depth="3"
      >
        {{ googleFontsCatalogError }}
      </NText>
    </div>

    <NModal
      v-model:show="fontBrowserShown"
      preset="card"
      title="Google Fonts"
      class="font-browser-modal"
      style="width: min(820px, 92vw)"
    >
      <div class="font-browser-controls">
        <NInput
          v-model:value="fontSearch"
          clearable
          placeholder="搜索字体名称"
        >
          <template #prefix>
            <NIcon :component="SearchOutline" />
          </template>
        </NInput>
        <NSelect
          v-model:value="fontCategory"
          :options="fontCategoryOptions"
          clearable
          placeholder="全部分类"
        />
      </div>
      <NText
        v-if="googleFontsCatalogError"
        class="font-browser-error"
        type="error"
      >
        {{ googleFontsCatalogError }}
      </NText>
      <div class="font-browser-body">
        <NVirtualList
          v-if="browsableFonts.length"
          class="font-browser-list"
          :items="browsableFonts"
          :item-size="46"
          key-field="family"
          @pointerdown.capture="handleFontBrowserPointerDown"
          @scroll="handleFontBrowserScroll"
        >
          <template #default="{ item }">
            <GoogleFontBrowserRow
              :font="item"
              :active="activePreviewFamily === item.family"
              :category-label="fontCategoryLabels[item.category] ?? item.category"
              :load-preview="fontRowPreviewEnabled"
              @select="fontPreviewFamily = $event"
            />
          </template>
        </NVirtualList>
        <div
          v-else-if="googleFontsCatalogLoading"
          class="font-browser-empty"
        >
          <NSpin size="small" />
        </div>
        <NEmpty
          v-else
          class="font-browser-empty"
          size="small"
        />
        <section
          v-if="activePreviewFamily"
          class="font-browser-preview"
        >
          <NText depth="3">
            {{ activePreviewFamily }}
          </NText>
          <div
            class="font-browser-preview__sample"
            :style="browserPreviewStyle"
          >
            春风又绿江南岸<br />
            The quick brown fox<br />
            0123456789
          </div>
          <NButton
            type="primary"
            :disabled="model === activePreviewFamily"
            @click="applyPreviewFont"
          >
            {{ model === activePreviewFamily ? '正在使用' : '使用此字体' }}
          </NButton>
        </section>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.google-font-picker {
  width: 100%;
}

.font-field {
  display: grid;
  gap: 8px;
  width: 100%;
}

.font-picker {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  gap: 6px;
}

.font-browser-button {
  width: 34px;
  height: 34px;
}

.font-preview {
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  color: var(--vtsuru-fg);
  font-size: 16px;
  line-height: 1.25;
}

.font-browser-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  gap: 8px;
  margin-bottom: 12px;
}

.font-browser-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  min-height: 420px;
}

.font-browser-error {
  display: block;
  margin: -4px 0 10px;
}

.font-browser-list {
  height: 420px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
}

.font-browser-empty {
  height: 420px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.font-browser-preview {
  min-width: 0;
  padding-left: 16px;
  border-left: 1px solid var(--vtsuru-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.font-browser-preview__sample {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--vtsuru-fg);
  font-size: 24px;
  line-height: 1.65;
}

@media (max-width: 640px) {
  .font-browser-controls,
  .font-browser-body {
    grid-template-columns: 1fr;
  }

  .font-browser-body {
    min-height: 0;
  }

  .font-browser-list,
  .font-browser-empty {
    height: 300px;
  }

  .font-browser-preview {
    padding: 12px 0 0;
    border-top: 1px solid var(--vtsuru-border);
    border-left: 0;
  }

  .font-browser-preview__sample {
    min-height: 150px;
  }
}
</style>
