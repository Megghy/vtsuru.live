<script setup lang="ts">
import { Info16Regular, TextFont24Regular } from '@vicons/fluent'
import { SearchOutline } from '@vicons/ionicons5'
import { useEventListener } from '@vueuse/core'
import {
  NButton,
  NColorPicker,
  NEmpty,
  NFlex,
  NFormItem,
  NIcon,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NSwitch,
  NTag,
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
import type { UserPageTextTheme } from '@/apps/user-page/theme'
import { resolveUserPageTextColor } from '@/apps/user-page/theme'

import GoogleFontBrowserRow from './GoogleFontBrowserRow.vue'
import PropsGrid from './PropsGrid.vue'

export interface ThemeTextColorTarget {
  get: () => UserPageTextTheme | undefined
  ensure: () => UserPageTextTheme
  cleanup?: () => void
}

const props = defineProps<{ target: ThemeTextColorTarget }>()

function colorModel(key: 'textColor' | 'textColorLight' | 'textColorDark') {
  return computed<string | undefined>({
    get: () => props.target.get()?.[key],
    set(value) {
      if (value?.trim()) props.target.ensure()[key] = value
      else {
        const theme = props.target.get()
        if (theme) delete theme[key]
        props.target.cleanup?.()
      }
    },
  })
}

const textColor = colorModel('textColor')
const textColorLight = colorModel('textColorLight')
const textColorDark = colorModel('textColorDark')
const fontFamily = computed<string | null>({
  get: () => props.target.get()?.fontFamily ?? null,
  set(value) {
    if (value) props.target.ensure().fontFamily = value
    else {
      const theme = props.target.get()
      if (theme) delete theme.fontFamily
      props.target.cleanup?.()
    }
  },
})
const fontOptions = computed(() => {
  const options = googleFontsCatalog.value.map((font) => ({ label: font.family, value: font.family }))
  const selected = fontFamily.value
  if (selected && !googleFontsCatalog.value.some((font) => font.family === selected)) {
    options.unshift({ label: selected, value: selected })
  }
  return options
})
const selectedFontStyle = computed(() => ({ fontFamily: getGoogleFontFamilyCss(fontFamily.value) }))
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
  () => fontPreviewFamily.value ?? fontFamily.value ?? browsableFonts.value[0]?.family ?? null,
)
const browserPreviewStyle = computed(() => ({ fontFamily: getGoogleFontFamilyCss(activePreviewFamily.value) }))
useGoogleFont(computed(() => fontFamily.value ?? undefined))
useGoogleFont(computed(() => (fontBrowserShown.value ? (activePreviewFamily.value ?? undefined) : undefined)))

function loadFontCatalog(show = true) {
  if (!show) return
  void loadGoogleFontsCatalog().catch((error) => console.error('Google Fonts 字体目录加载失败', error))
}

function openFontBrowser() {
  fontPreviewFamily.value = fontFamily.value
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
  fontFamily.value = activePreviewFamily.value
  fontBrowserShown.value = false
}

const autoTextContrast = computed({
  get: () => props.target.get()?.autoTextContrast !== false,
  set(value: boolean) {
    if (value) {
      const theme = props.target.get()
      if (theme) delete theme.autoTextContrast
      props.target.cleanup?.()
    } else props.target.ensure().autoTextContrast = false
  },
})
const themeMode = computed(() => props.target.get()?.pageThemeMode ?? 'auto')
const showLightColor = computed(() => themeMode.value !== 'dark')
const showDarkColor = computed(() => themeMode.value !== 'light')
const lightResult = computed(() => resolveUserPageTextColor(props.target.get(), false))
const darkResult = computed(() => resolveUserPageTextColor(props.target.get(), true))
</script>

<template>
  <div class="text-color-editor">
    <NFormItem label="字体">
      <div class="font-field">
        <div class="font-picker">
          <NSelect
            v-model:value="fontFamily"
            :options="fontOptions"
            :loading="googleFontsCatalogLoading"
            filterable
            clearable
            placeholder="使用上级或站点默认字体"
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
          v-if="fontFamily"
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
    </NFormItem>
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
            :disabled="fontFamily === activePreviewFamily"
            @click="applyPreviewFont"
          >
            {{ fontFamily === activePreviewFamily ? '正在使用' : '使用此字体' }}
          </NButton>
        </section>
      </div>
    </NModal>
    <PropsGrid :min-item-width="220">
      <NFormItem label="基础文字颜色">
        <NColorPicker
          v-model:value="textColor"
          :show-alpha="false"
          :modes="['hex']"
          :actions="['clear']"
        />
      </NFormItem>
      <NFormItem>
        <template #label>
          <NFlex
            align="center"
            :size="4"
          >
            <span>自动保证对比度</span>
            <NTooltip trigger="hover">
              <template #trigger>
                <NIcon
                  :component="Info16Regular"
                  :size="15"
                  class="contrast-help"
                  tabindex="0"
                  aria-label="自动对比度说明"
                />
              </template>
              根据亮色或暗色模式下最不利的页面背景微调最终显示颜色，至少保持 4.5:1
              对比度。不会修改已选择的颜色，亮色或暗色覆盖色会优先于基础文字颜色。
            </NTooltip>
          </NFlex>
        </template>
        <NSwitch v-model:value="autoTextContrast" />
      </NFormItem>
      <NFormItem
        v-if="showLightColor"
        label="亮色模式覆盖"
      >
        <NColorPicker
          v-model:value="textColorLight"
          :show-alpha="false"
          :modes="['hex']"
          :actions="['clear']"
        />
      </NFormItem>
      <NFormItem
        v-if="showDarkColor"
        label="暗色模式覆盖"
      >
        <NColorPicker
          v-model:value="textColorDark"
          :show-alpha="false"
          :modes="['hex']"
          :actions="['clear']"
        />
      </NFormItem>
    </PropsGrid>
    <NFlex size="small">
      <NTag
        v-if="showLightColor"
        :type="lightResult.contrast >= 4.5 ? 'success' : 'warning'"
        size="small"
      >
        亮色 {{ lightResult.contrast.toFixed(2) }}:1{{ lightResult.adjusted ? ' · 已微调' : '' }}
      </NTag>
      <NTag
        v-if="showDarkColor"
        :type="darkResult.contrast >= 4.5 ? 'success' : 'warning'"
        size="small"
      >
        暗色 {{ darkResult.contrast.toFixed(2) }}:1{{ darkResult.adjusted ? ' · 已微调' : '' }}
      </NTag>
    </NFlex>
  </div>
</template>

<style scoped>
.text-color-editor {
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

.contrast-help {
  color: var(--vtsuru-fg-muted);
  cursor: help;
}
</style>
