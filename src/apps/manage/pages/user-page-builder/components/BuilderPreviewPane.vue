<script setup lang="ts">
import type { GlobalThemeOverrides } from 'naive-ui'
import { darkTheme, NAlert, NButton, NButtonGroup, NCard, NConfigProvider, NFlex, NIcon, NTooltip } from 'naive-ui'
import { computed, inject, ref } from 'vue'
import { DesktopOutline, OpenOutline, PhonePortraitOutline, TabletPortraitOutline } from '@vicons/ionicons5'
import BlockPageRenderer from '@/apps/user-page/block/BlockPageRenderer.vue'
import DefaultIndexTemplate from '@/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue'
import { getPageBackgroundCssVars, resolvePageBackground } from '@/apps/user-page/background'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import { getThemeOverrides } from '@/shared/config/theme'
import { isDarkMode } from '@/shared/utils'
import PhonePreview from './PhonePreview.vue'
import type { PreviewViewport } from './PhonePreview.vue'
import { UserPageEditorKey } from '../context'

defineOptions({ name: 'BuilderPreviewPane' })

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const viewport = ref<PreviewViewport>('desktop')
const viewportOptions: Array<{ value: PreviewViewport, label: string, icon: typeof PhonePortraitOutline }> = [
  { value: 'phone', label: '手机', icon: PhonePortraitOutline },
  { value: 'tablet', label: '平板', icon: TabletPortraitOutline },
  { value: 'desktop', label: '桌面', icon: DesktopOutline },
]

const previewMergedTheme = computed(() => {
  const globalTheme = (editor.settings.value as any)?.theme ?? {}
  const pageTheme = (editor.currentPage.value as any)?.theme ?? {}
  const projectTheme = (editor.currentProject.value?.theme as any) ?? {}
  return { ...globalTheme, ...pageTheme, ...projectTheme }
})

const previewMergedProject = computed(() => {
  const p = editor.currentProject.value
  if (!p) return null
  return { ...p, theme: previewMergedTheme.value }
})

const previewEffectiveIsDark = computed(() => {
  const mode = (previewMergedTheme.value as any)?.pageThemeMode
  return resolvePageThemeIsDark(mode, isDarkMode.value)
})

const previewNaiveTheme = computed(() => (previewEffectiveIsDark.value ? darkTheme : null))

const previewBg = computed(() => {
  const pageOverride = resolvePageBackground((editor.currentPage.value as any)?.background)
  if (pageOverride) return pageOverride
  const globalBg = resolvePageBackground((editor.settings.value as any)?.background)
  if (globalBg) return globalBg
  return resolvePageBackground(previewMergedProject.value?.theme)
})

const previewBgVars = computed(() => {
  const bg = previewBg.value
  if (!bg) return {}
  return getPageBackgroundCssVars(bg, previewEffectiveIsDark.value)
})

const previewSurfaceThemeOverrides = computed<GlobalThemeOverrides>(() => {
  const bg = previewBg.value
  if (!bg || bg.blurMode === 'none') return {}
  const vars = previewBgVars.value as any
  const surfaceBg = vars['--user-page-ui-surface-bg']
  const surfaceBgHover = vars['--user-page-ui-surface-bg-hover']
  const surfaceBgPressed = vars['--user-page-ui-surface-bg-pressed']
  const borderColor = vars['--vtsuru-card-border-color'] ?? vars['--user-page-border-color']
  return {
    common: {
      borderColor,
      dividerColor: borderColor,
    },
    Card: {
      color: surfaceBg,
      colorEmbedded: surfaceBgHover,
      borderColor,
    },
    List: {
      color: 'transparent',
      listItemColor: 'transparent',
      borderColor,
    },
    Button: {
      color: surfaceBg,
      colorHover: surfaceBgHover,
      colorPressed: surfaceBgPressed,
    },
  }
})

const previewThemeOverrides = computed<GlobalThemeOverrides>(() => {
  const base = getThemeOverrides(previewEffectiveIsDark.value)
  const surface = previewSurfaceThemeOverrides.value
  return {
    ...base,
    ...surface,
    common: { ...base.common, ...surface.common },
    Card: { ...base.Card, ...surface.Card },
    List: { ...base.List, ...surface.List },
    Button: { ...base.Button, ...surface.Button },
  }
})

const previewBgClass = computed(() => ({
  'preview-bg-host': true,
  enabled: !!previewBg.value,
  glass: previewBg.value?.blurMode === 'glass',
  'bg-blur': previewBg.value?.blurMode === 'background',
}))
</script>

<template>
  <NCard
    class="pane-card"
    :title="`预览 - ${editor.currentLabel.value}`"
    content-style="display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden"
  >
    <template #header-extra>
      <NFlex align="center" :wrap="false" size="small">
        <NButtonGroup size="small">
          <NTooltip v-for="option in viewportOptions" :key="option.value">
            <template #trigger>
              <NButton
                :type="viewport === option.value ? 'primary' : 'default'"
                :secondary="viewport === option.value"
                :aria-label="`${option.label}预览`"
                @click="viewport = option.value"
              >
                <template #icon>
                  <NIcon><component :is="option.icon" /></NIcon>
                </template>
              </NButton>
            </template>
            {{ option.label }}预览
          </NTooltip>
        </NButtonGroup>
        <NTooltip>
          <template #trigger>
            <NButton quaternary circle size="small" aria-label="在真实页面中预览草稿" @click="editor.openPreview">
              <template #icon>
                <NIcon><OpenOutline /></NIcon>
              </template>
            </NButton>
          </template>
          在真实页面中预览草稿
        </NTooltip>
      </NFlex>
    </template>
    <div class="preview-pane-content">
      <NConfigProvider abstract :theme="null" :theme-overrides="null">
        <NConfigProvider abstract :theme="previewNaiveTheme" :theme-overrides="previewThemeOverrides">
          <PhonePreview
            :style="previewBgVars"
            :is-dark="previewEffectiveIsDark"
            :transparent="!!previewBg"
            :viewport="viewport"
          >
            <template #background>
              <div :class="previewBgClass" />
            </template>

            <Transition name="fade-slide" mode="out-in">
              <div
                :key="editor.currentPage.value.mode === 'block' && editor.currentProject.value ? 'block' : editor.currentPage.value.mode"
                class="preview-content"
              >
                <template v-if="editor.currentPage.value.mode === 'block' && previewMergedProject">
                  <div :class="{ 'preview-glass-surface': previewBg?.blurMode === 'glass' }">
                    <BlockPageRenderer
                      :project="previewMergedProject"
                      :user-info="editor.account.value"
                      :bili-info="undefined"
                      :is-dark="previewEffectiveIsDark"
                      :extra-theme-overrides="previewSurfaceThemeOverrides"
                      :highlight-block-id="editor.hoveredBlockId.value"
                    />
                  </div>
                </template>
                <template v-else-if="editor.currentPage.value.mode === 'legacy'">
                  <DefaultIndexTemplate :user-info="editor.account.value as any" :bili-info="undefined" />
                </template>
                <NAlert
                  v-else
                  type="warning"
                  :show-icon="true"
                >
                  当前页模式：{{ editor.getPageModeLabel(editor.currentPage.value.mode) }}，非区块页，不展示预览。
                </NAlert>
              </div>
            </Transition>
          </PhonePreview>
        </NConfigProvider>
      </NConfigProvider>
    </div>
  </NCard>
</template>

<style scoped>
.preview-pane-content {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
