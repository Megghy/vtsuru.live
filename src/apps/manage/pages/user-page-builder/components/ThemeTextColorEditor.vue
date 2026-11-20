<script setup lang="ts">
import { computed } from 'vue'

import type { UserPageTextTheme } from '@/apps/user-page/theme'
import { resolveUserPageTextColor } from '@/apps/user-page/theme'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Switch } from '@/shared/ui/switch'
import { Tag } from '@/shared/ui/tag'

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
  <div class="w-full flex flex-col gap-3">
    <FormField label="字体">
      <GoogleFontPicker
        v-model="fontFamily"
        placeholder="使用上级或站点默认字体"
      />
    </FormField>

    <PropsGrid :min-item-width="220">
      <FormField label="基础文字颜色">
        <ColorPicker v-model="textColor" />
      </FormField>

      <FormField
        label="自动保证对比度"
        hint="根据亮色或暗色模式下最不利的页面背景微调最终显示颜色，至少保持 4.5:1 对比度。不会修改已选择的颜色，亮色或暗色覆盖色会优先于基础文字颜色。"
        class="justify-center"
      >
        <div class="pt-1">
          <Switch
            :checked="autoTextContrast"
            @update:checked="autoTextContrast = $event"
          />
        </div>
      </FormField>

      <FormField
        v-if="showLightColor"
        label="亮色模式覆盖"
      >
        <ColorPicker v-model="textColorLight" />
      </FormField>

      <FormField
        v-if="showDarkColor"
        label="暗色模式覆盖"
      >
        <ColorPicker v-model="textColorDark" />
      </FormField>
    </PropsGrid>

    <div class="flex flex-wrap gap-2 pt-1">
      <Tag
        v-if="showLightColor"
        :variant="lightResult.contrast >= 4.5 ? 'secondary' : 'destructive'"
        class="text-xs"
      >
        亮色 {{ lightResult.contrast.toFixed(2) }}:1{{ lightResult.adjusted ? ' · 已微调' : '' }}
      </Tag>
      <Tag
        v-if="showDarkColor"
        :variant="darkResult.contrast >= 4.5 ? 'secondary' : 'destructive'"
        class="text-xs"
      >
        暗色 {{ darkResult.contrast.toFixed(2) }}:1{{ darkResult.adjusted ? ' · 已微调' : '' }}
      </Tag>
    </div>
  </div>
</template>
