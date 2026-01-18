<script setup lang="ts">
import type { GlobalThemeOverrides } from 'naive-ui'
import { NAlert, NCard, NConfigProvider, NScrollbar } from 'naive-ui';
import { computed, inject } from 'vue'
import BlockPageRenderer from '@/apps/user-page/block/BlockPageRenderer.vue'
import DefaultIndexTemplate from '@/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue'
import { getPageBackgroundCssVars, resolvePageBackground } from '@/apps/user-page/background'
import PhonePreview from './PhonePreview.vue'
import { UserPageEditorKey } from '../context'

defineOptions({ name: 'BuilderPreviewPane' })

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

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
  const mode = (previewMergedProject.value?.theme as any)?.pageThemeMode
  return mode === 'light' ? false : true
})

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
    <NScrollbar class="pane-scroll">
      <div style="height: 100%; min-height: 0; display: flex; flex-direction: column">
        <PhonePreview
          style="flex: 1; min-height: 0"
          :style="previewBgVars"
          :transparent="!!previewBg"
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
                <div v-if="previewBg?.blurMode === 'glass'" class="preview-glass-surface">
                  <BlockPageRenderer
                    :project="previewMergedProject"
                    :user-info="editor.account.value"
                    :bili-info="undefined"
                    :extra-theme-overrides="previewSurfaceThemeOverrides"
                    :highlight-block-id="editor.hoveredBlockId.value"
                  />
                </div>
                <BlockPageRenderer
                  v-else
                  :project="previewMergedProject"
                  :user-info="editor.account.value"
                  :bili-info="undefined"
                  :extra-theme-overrides="previewSurfaceThemeOverrides"
                  :highlight-block-id="editor.hoveredBlockId.value"
                />
              </template>
              <template v-else-if="editor.currentPage.value.mode === 'legacy'">
                <NConfigProvider :theme-overrides="previewSurfaceThemeOverrides">
                  <DefaultIndexTemplate :user-info="editor.account.value as any" :bili-info="undefined" />
                </NConfigProvider>
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
      </div>
    </NScrollbar>
  </NCard>
</template>
