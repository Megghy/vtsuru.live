<script setup lang="ts">
import type { UserPageTextTheme } from '@/apps/user-page/theme'
import { resolveUserPageTextColor } from '@/apps/user-page/theme'
import { Info16Regular } from '@vicons/fluent'
import { NColorPicker, NFlex, NFormItem, NIcon, NSwitch, NTag, NTooltip } from 'naive-ui'
import { computed } from 'vue'
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
    <PropsGrid :min-item-width="220">
      <NFormItem label="基础文字颜色">
        <NColorPicker v-model:value="textColor" :show-alpha="false" :modes="['hex']" clearable />
      </NFormItem>
      <NFormItem>
        <template #label>
          <NFlex align="center" :size="4">
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
              根据亮色或暗色模式下最不利的页面背景微调最终显示颜色，至少保持 4.5:1 对比度。不会修改已选择的颜色，亮色或暗色覆盖色会优先于基础文字颜色。
            </NTooltip>
          </NFlex>
        </template>
        <NSwitch v-model:value="autoTextContrast" />
      </NFormItem>
      <NFormItem v-if="showLightColor" label="亮色模式覆盖">
        <NColorPicker v-model:value="textColorLight" :show-alpha="false" :modes="['hex']" clearable />
      </NFormItem>
      <NFormItem v-if="showDarkColor" label="暗色模式覆盖">
        <NColorPicker v-model:value="textColorDark" :show-alpha="false" :modes="['hex']" clearable />
      </NFormItem>
    </PropsGrid>
    <NFlex size="small">
      <NTag v-if="showLightColor" :type="lightResult.contrast >= 4.5 ? 'success' : 'warning'" size="small">
        亮色 {{ lightResult.contrast.toFixed(2) }}:1{{ lightResult.adjusted ? ' · 已微调' : '' }}
      </NTag>
      <NTag v-if="showDarkColor" :type="darkResult.contrast >= 4.5 ? 'success' : 'warning'" size="small">
        暗色 {{ darkResult.contrast.toFixed(2) }}:1{{ darkResult.adjusted ? ' · 已微调' : '' }}
      </NTag>
    </NFlex>
  </div>
</template>

<style scoped>
.text-color-editor {
  width: 100%;
}

.contrast-help {
  color: var(--vtsuru-fg-muted);
  cursor: help;
}
</style>
