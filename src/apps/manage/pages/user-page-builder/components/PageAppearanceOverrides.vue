<script setup lang="ts">
import { NButton, NCollapseItem, NColorPicker, NFlex, NForm, NFormItem, NSelect, NText } from 'naive-ui'
import { computed, inject } from 'vue'

import type { UserPageThemeConfigV1 } from '@/apps/user-page/types'

import { UserPageEditorKey } from '../context'
import BackgroundSettingsEditor from './BackgroundSettingsEditor.vue'
import type { BackgroundSettingsTarget } from './BackgroundSettingsEditor.vue'
import PropsGrid from './PropsGrid.vue'
import ThemeAdvancedOptions from './ThemeAdvancedOptions.vue'
import type { ThemeAppearanceTarget } from './ThemeAdvancedOptions.vue'
import ThemeTextColorEditor from './ThemeTextColorEditor.vue'
import type { ThemeTextColorTarget } from './ThemeTextColorEditor.vue'

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const page = computed(() => editor.currentPage.value)
const backgroundTarget: BackgroundSettingsTarget = {
  get: () => page.value.background,
  ensure: () => (page.value.background ??= {}),
  uploadImage: editor.triggerUploadPageBackgroundOverride,
  clearImage: editor.clearPageBackgroundOverrideImageFile,
}

type ColorKey = 'primaryColor' | 'backgroundColor'

function cleanupEmptyTheme() {
  if (page.value.theme && Object.keys(page.value.theme).length === 0) delete page.value.theme
}

function colorModel(key: ColorKey) {
  return computed<string | undefined>({
    get: () => page.value.theme?.[key],
    set(value) {
      if (!value?.trim()) {
        if (page.value.theme) delete page.value.theme[key]
        cleanupEmptyTheme()
        return
      }
      const theme = (page.value.theme ??= {})
      theme[key] = value
    },
  })
}

const primaryColor = colorModel('primaryColor')
const backgroundColor = colorModel('backgroundColor')
const textColorTarget: ThemeTextColorTarget = {
  get: () => page.value.theme,
  ensure: () => (page.value.theme ??= {}),
  cleanup: cleanupEmptyTheme,
}
const appearanceTarget: ThemeAppearanceTarget = {
  get: () => page.value.theme,
  ensure: () => (page.value.theme ??= {}),
  cleanup: cleanupEmptyTheme,
}
const themeMode = computed<NonNullable<UserPageThemeConfigV1['pageThemeMode']>>({
  get: () => page.value.theme?.pageThemeMode ?? 'auto',
  set(value) {
    if (value === 'auto') {
      if (page.value.theme) delete page.value.theme.pageThemeMode
      cleanupEmptyTheme()
      return
    }
    const theme = (page.value.theme ??= {})
    theme.pageThemeMode = value
  },
})
</script>

<template>
  <NCollapseItem
    v-if="page.mode !== 'block'"
    class="page-bg-section"
    title="页面背景"
    name="page-bg"
  >
    <NFlex
      justify="space-between"
      align="center"
      style="margin-bottom: 10px"
    >
      <NText depth="3"> 不设置时将使用全局背景或默认背景。 </NText>
      <NButton
        size="small"
        secondary
        :disabled="!page.background"
        @click="page.background = undefined"
      >
        使用全局背景
      </NButton>
    </NFlex>
    <BackgroundSettingsEditor :target="backgroundTarget" />
  </NCollapseItem>

  <NCollapseItem
    v-if="page.mode !== 'block'"
    class="page-theme-section"
    title="页面主题"
    name="page-theme"
  >
    <NFlex
      justify="space-between"
      align="center"
      style="margin-bottom: 10px"
    >
      <NText depth="3"> 不设置时将使用全局主题或站点主题。 </NText>
      <NButton
        size="small"
        secondary
        :disabled="!page.theme"
        @click="page.theme = undefined"
      >
        清除页面主题
      </NButton>
    </NFlex>
    <NForm
      label-placement="top"
      size="small"
    >
      <PropsGrid>
        <NFormItem label="主题色 primary">
          <NFlex
            align="center"
            :wrap="false"
            style="gap: 10px"
          >
            <div style="flex: 1; min-width: 0">
              <NColorPicker v-model:value="primaryColor" />
            </div>
            <NButton
              size="tiny"
              secondary
              :disabled="primaryColor == null"
              @click="primaryColor = undefined"
            >
              清除
            </NButton>
          </NFlex>
        </NFormItem>
        <NFormItem label="内容区域底色">
          <NFlex
            align="center"
            :wrap="false"
            style="gap: 10px"
          >
            <div style="flex: 1; min-width: 0">
              <NColorPicker v-model:value="backgroundColor" />
            </div>
            <NButton
              size="tiny"
              secondary
              :disabled="backgroundColor == null"
              @click="backgroundColor = undefined"
            >
              清除
            </NButton>
          </NFlex>
        </NFormItem>
        <NFormItem label="页面主题模式">
          <NSelect
            v-model:value="themeMode"
            :options="[
              { label: '跟随站点', value: 'auto' },
              { label: '强制亮色', value: 'light' },
              { label: '强制暗色', value: 'dark' },
            ]"
          />
        </NFormItem>
      </PropsGrid>
      <ThemeTextColorEditor :target="textColorTarget" />
      <ThemeAdvancedOptions :target="appearanceTarget" />
    </NForm>
  </NCollapseItem>
</template>
