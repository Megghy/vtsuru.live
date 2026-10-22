<script setup lang="ts">
import { computed, inject } from 'vue'

import type { UserPageThemeConfigV1 } from '@/apps/user-page/types'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/accordion'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

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
  <AccordionItem
    v-if="page.mode !== 'block'"
    value="page-bg"
    class="border-b border-border"
  >
    <AccordionTrigger class="text-xs font-semibold py-2.5">
      页面背景
    </AccordionTrigger>
    <AccordionContent class="pt-2 pb-4 flex flex-col gap-3">
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>不设置时将使用全局背景或默认背景。</span>
        <Button variant="outline" class="h-6 px-2" :disabled="!page.background" @click="page.background = undefined">
          使用全局背景
        </Button>
      </div>
      <BackgroundSettingsEditor :target="backgroundTarget" />
    </AccordionContent>
  </AccordionItem>

  <AccordionItem
    v-if="page.mode !== 'block'"
    value="page-theme"
    class="border-b border-border"
  >
    <AccordionTrigger class="text-xs font-semibold py-2.5">
      页面主题
    </AccordionTrigger>
    <AccordionContent class="pt-2 pb-4 flex flex-col gap-3">
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>不设置时将使用全局主题或站点主题。</span>
        <Button variant="outline" class="h-6 px-2" :disabled="!page.theme" @click="page.theme = undefined">
          清除页面主题
        </Button>
      </div>

      <PropsGrid>
        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">主题色 primary</label>
          <div class="flex items-center gap-2">
            <ColorPicker v-model="primaryColor" class="flex-1" />
            <Button variant="outline" class="px-2" :disabled="primaryColor == null" @click="primaryColor = undefined">
              清除
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">内容区域底色</label>
          <div class="flex items-center gap-2">
            <ColorPicker v-model="backgroundColor" class="flex-1" />
            <Button variant="outline" class="px-2" :disabled="backgroundColor == null" @click="backgroundColor = undefined">
              清除
            </Button>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">页面主题模式</label>
          <Select v-model="themeMode">
            <SelectTrigger>
              <SelectValue placeholder="模式" />
            </SelectTrigger>
            <SelectContent class="text-xs">
              <SelectItem value="auto">跟随站点</SelectItem>
              <SelectItem value="light">强制亮色</SelectItem>
              <SelectItem value="dark">强制暗色</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PropsGrid>

      <ThemeTextColorEditor :target="textColorTarget" />
      <ThemeAdvancedOptions :target="appearanceTarget" />
    </AccordionContent>
  </AccordionItem>
</template>
