<script setup lang="ts">
import { NAlert, NButton, NColorPicker, NDivider, NFlex, NForm, NFormItem, NModal, NScrollbar, NSelect } from 'naive-ui'
import { computed, inject, ref } from 'vue'

import { UserPageEditorKey } from '../context'
import BackgroundSettingsEditor from './BackgroundSettingsEditor.vue'
import type { BackgroundSettingsTarget } from './BackgroundSettingsEditor.vue'
import GlobalCssEditorModal from './GlobalCssEditorModal.vue'
import ThemeAdvancedOptions from './ThemeAdvancedOptions.vue'
import type { ThemeAppearanceTarget } from './ThemeAdvancedOptions.vue'
import ThemeTextColorEditor from './ThemeTextColorEditor.vue'
import type { ThemeTextColorTarget } from './ThemeTextColorEditor.vue'

const show = defineModel<boolean>('show', { required: true })
const cssEditorVisible = ref(false)
const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const backgroundTarget: BackgroundSettingsTarget = {
  get: () => (editor.settings.value as any).background,
  ensure: () => ((editor.settings.value as any).background ??= {}),
  uploadImage: editor.triggerUploadGlobalBackground,
  clearImage: editor.clearGlobalBackgroundImageFile,
}

function ensureTheme() {
  return ((editor.settings.value as any).theme ??= {})
}

function cleanupEmptyTheme() {
  const theme = (editor.settings.value as any).theme
  if (theme && Object.keys(theme).length === 0) delete (editor.settings.value as any).theme
}

function themeColor(key: 'primaryColor' | 'backgroundColor') {
  return computed<string | undefined>({
    get: () => {
      const value = (editor.settings.value as any).theme?.[key]
      return typeof value === 'string' ? value : undefined
    },
    set: (value) => {
      if (value?.trim()) ensureTheme()[key] = value
      else {
        delete (editor.settings.value as any).theme?.[key]
        cleanupEmptyTheme()
      }
    },
  })
}

const primaryColor = themeColor('primaryColor')
const backgroundColor = themeColor('backgroundColor')
const textColorTarget: ThemeTextColorTarget = {
  get: () => (editor.settings.value as any).theme,
  ensure: ensureTheme,
  cleanup: cleanupEmptyTheme,
}
const appearanceTarget: ThemeAppearanceTarget = {
  get: () => (editor.settings.value as any).theme,
  ensure: ensureTheme,
  cleanup: cleanupEmptyTheme,
}
const themeMode = computed<'auto' | 'light' | 'dark'>({
  get: () => {
    const value = (editor.settings.value as any).theme?.pageThemeMode
    return value === 'light' || value === 'dark' ? value : 'auto'
  },
  set: (value) => {
    if (value === 'auto') {
      delete (editor.settings.value as any).theme?.pageThemeMode
      cleanupEmptyTheme()
    } else ensureTheme().pageThemeMode = value
  },
})

function clearTheme() {
  delete (editor.settings.value as any).theme
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    title="全局主题"
    style="width: 720px; max-width: 95vw"
    :auto-focus="false"
  >
    <NScrollbar style="max-height: min(78vh, 720px)">
      <div class="modal-content">
        <NAlert
          type="info"
          :show-icon="true"
          style="margin-bottom: 12px"
        >
          全局背景和主题会应用到主页、子页面及内置页面，页面级设置可以覆盖这里的值。
        </NAlert>
        <NDivider style="margin: 10px 0"> 背景 </NDivider>
        <BackgroundSettingsEditor
          :target="backgroundTarget"
          none-hint="未设置时使用站点默认背景。"
        />
        <NDivider style="margin: 10px 0"> 主题 </NDivider>
        <NForm
          label-placement="top"
          size="small"
        >
          <NFlex
            :wrap="true"
            style="gap: 12px"
          >
            <NFormItem
              label="主题色"
              class="color-field"
            >
              <NColorPicker
                v-model:value="primaryColor"
                :modes="['hex']"
              />
            </NFormItem>
            <NFormItem
              label="内容底色"
              class="color-field"
            >
              <NColorPicker
                v-model:value="backgroundColor"
                :modes="['hex']"
              />
            </NFormItem>
            <NFormItem
              label="主题模式"
              class="color-field"
            >
              <NSelect
                v-model:value="themeMode"
                :options="[
                  { label: '跟随站点', value: 'auto' },
                  { label: '亮色', value: 'light' },
                  { label: '暗色', value: 'dark' },
                ]"
              />
            </NFormItem>
          </NFlex>
          <ThemeTextColorEditor :target="textColorTarget" />
          <ThemeAdvancedOptions :target="appearanceTarget" />
          <NFlex justify="end">
            <NButton
              size="small"
              secondary
              :disabled="!(editor.settings.value as any).theme"
              @click="clearTheme"
            >
              清除主题
            </NButton>
          </NFlex>
        </NForm>
        <NDivider style="margin: 10px 0"> 自定义 CSS </NDivider>
        <NFlex
          justify="space-between"
          align="center"
          :wrap="false"
        >
          <span class="css-status">
            {{ editor.settings.value.customCss ? '已设置全局 CSS' : '未设置全局 CSS' }}
          </span>
          <NButton
            size="small"
            secondary
            @click="cssEditorVisible = true"
          >
            编辑全局 CSS
          </NButton>
        </NFlex>
      </div>
    </NScrollbar>
  </NModal>
  <GlobalCssEditorModal v-model:show="cssEditorVisible" />
</template>

<style scoped>
.modal-content {
  padding-right: 16px;
  padding-bottom: 16px;
}

.color-field {
  min-width: 220px;
  flex: 1;
}

.css-status {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
</style>
