<script setup lang="ts">
import DesktopOutline from '@vicons/ionicons5/es/DesktopOutline'
import Moon from '@vicons/ionicons5/es/Moon'
import Sunny from '@vicons/ionicons5/es/Sunny'
import { computed } from 'vue'

import { ThemeType } from '@/api/client-types'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { cycleThemeType, getThemeTypeLabel, themeType } from '@/shared/utils'

const props = withDefaults(
  defineProps<{
    variant?: 'outline' | 'ghost'
    disabled?: boolean
    forcedMode?: 'auto' | 'light' | 'dark'
  }>(),
  {
    variant: 'outline',
    disabled: false,
    forcedMode: 'auto',
  },
)

const isForced = computed(() => props.forcedMode === 'dark' || props.forcedMode === 'light')

const iconComponent = computed(() => {
  if (props.forcedMode === 'dark') return Moon
  if (props.forcedMode === 'light') return Sunny
  switch (themeType.value) {
    case ThemeType.Light:
      return Sunny
    case ThemeType.Dark:
      return Moon
    case ThemeType.Auto:
    default:
      return DesktopOutline
  }
})

const labelText = computed(() => {
  if (props.forcedMode === 'dark') return '当前页面强制深色主题'
  if (props.forcedMode === 'light') return '当前页面强制浅色主题'
  const next = cycleThemeType(themeType.value)
  return `当前：${getThemeTypeLabel(themeType.value)}，点击切换为${getThemeTypeLabel(next)}`
})

function handleToggle() {
  if (props.disabled || isForced.value) return
  themeType.value = cycleThemeType(themeType.value)
}
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        :variant="variant"
        size="icon-xs"
        :disabled="disabled || isForced"
        :aria-label="labelText"
        @click="handleToggle"
      >
        <component
          :is="iconComponent"
          class="size-4 block"
        />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{ labelText }}</TooltipContent>
  </Tooltip>
</template>
