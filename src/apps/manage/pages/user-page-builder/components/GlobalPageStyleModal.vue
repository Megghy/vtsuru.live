<script setup lang="ts">
import { NAlert, NButton, NColorPicker, NDivider, NFlex, NForm, NFormItem, NModal, NScrollbar, NSelect } from 'naive-ui'
import { computed, inject } from 'vue'
import { UserPageEditorKey } from '../context'
import BackgroundSettingsEditor from './BackgroundSettingsEditor.vue'
import type { BackgroundSettingsTarget } from './BackgroundSettingsEditor.vue'

const show = defineModel<boolean>('show', { required: true })
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

function themeColor(key: 'primaryColor' | 'textColor' | 'backgroundColor') {
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
const textColor = themeColor('textColor')
const backgroundColor = themeColor('backgroundColor')
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
  <NModal v-model:show="show" preset="card" title="全局主题" style="width: 720px; max-width: 95vw" :auto-focus="false">
    <NScrollbar style="max-height: min(78vh, 720px)">
      <div class="modal-content">
        <NAlert type="info" :show-icon="true" style="margin-bottom: 12px">
          全局背景和主题会应用到主页、子页面及内置页面，页面级设置可以覆盖这里的值。
        </NAlert>
        <NDivider style="margin: 10px 0">
          背景
        </NDivider>
        <BackgroundSettingsEditor :target="backgroundTarget" none-hint="未设置时使用站点默认背景。" />
        <NDivider style="margin: 10px 0">
          主题
        </NDivider>
        <NForm label-placement="top" size="small">
          <NFlex :wrap="true" style="gap: 12px">
            <NFormItem label="主题色" class="color-field">
              <NColorPicker v-model:value="primaryColor" />
            </NFormItem>
            <NFormItem label="文字颜色" class="color-field">
              <NColorPicker v-model:value="textColor" />
            </NFormItem>
            <NFormItem label="内容底色" class="color-field">
              <NColorPicker v-model:value="backgroundColor" />
            </NFormItem>
            <NFormItem label="主题模式" class="color-field">
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
          <NFlex justify="end">
            <NButton size="small" secondary :disabled="!(editor.settings.value as any).theme" @click="clearTheme">
              清除主题
            </NButton>
          </NFlex>
        </NForm>
      </div>
    </NScrollbar>
  </NModal>
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
</style>
