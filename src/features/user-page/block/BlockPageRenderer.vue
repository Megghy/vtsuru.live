<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { darkTheme, NConfigProvider } from 'naive-ui'
import { computed } from 'vue'
import type { BlockPageProject } from './schema'
import { BLOCK_COMPONENTS } from './registry'
import { hexToRgba } from '@/shared/utils'

const props = defineProps<{
  project: BlockPageProject
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
}>()

const radius = computed(() => props.project.theme?.radius ?? 12)
const spacing = computed(() => {
  const v = props.project.theme?.spacing ?? 'normal'
  if (v === 'compact') return 10
  if (v === 'relaxed') return 18
  return 14
})
const containerStyle = computed(() => ({
  '--vtsuru-page-radius': `${radius.value}px`,
  '--vtsuru-page-spacing': `${spacing.value}px`,
  '--vtsuru-page-primary': props.project.theme?.primaryColor ?? 'var(--n-color)',
  '--vtsuru-page-bg': props.project.theme?.backgroundColor ?? 'transparent',
  '--vtsuru-page-text': props.project.theme?.textColor ?? 'inherit',
}))

const naiveTheme = computed(() => {
  const mode = (props.project.theme as any)?.pageThemeMode
  if (mode === 'dark') return darkTheme
  if (mode === 'light') return null
  return undefined
})

const themeOverrides = computed(() => {
  const t: any = props.project.theme ?? {}
  const primaryColor = typeof t.primaryColor === 'string' ? t.primaryColor : undefined
  const textColor = typeof t.textColor === 'string' ? t.textColor : undefined
  const bodyColor = typeof t.backgroundColor === 'string' ? t.backgroundColor : undefined
  const radiusPx = `${radius.value}px`
  const borderColor = textColor ? hexToRgba(textColor, 0.16) : null
  return {
    common: {
      ...(primaryColor ? { primaryColor } : {}),
      ...(textColor ? { textColorBase: textColor, textColor1: textColor, textColor2: textColor, textColor3: textColor } : {}),
      ...(bodyColor ? { bodyColor } : {}),
      ...(borderColor ? { borderColor, dividerColor: borderColor } : {}),
      borderRadius: radiusPx,
      borderRadiusSmall: radiusPx,
    },
    Button: {
      borderRadiusTiny: radiusPx,
      borderRadiusSmall: radiusPx,
      borderRadiusMedium: radiusPx,
      borderRadiusLarge: radiusPx,
    },
    Alert: {
      borderRadius: radiusPx,
      closeBorderRadius: radiusPx,
    },
    Card: {
      borderRadius: radiusPx,
      closeBorderRadius: radiusPx,
    },
  } as any
})

const blockComponents = BLOCK_COMPONENTS
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <div
      class="page"
      :style="containerStyle"
    >
      <div
        v-for="block in project.blocks"
        :key="block.id"
        class="block"
        :class="{ layout: block.type === 'layout' }"
      >
        <component
          :is="blockComponents[block.type]"
          v-if="!block.hidden"
          :block-props="block.props"
          :user-info="userInfo"
          :bili-info="biliInfo"
        />
      </div>
    </div>
  </NConfigProvider>
</template>

<style scoped>
.page {
  max-width: 820px;
  margin: 0 auto;
  padding: 8px 0;
  color: var(--vtsuru-page-text);
  background: var(--vtsuru-page-bg);
}
.block {
  padding: var(--vtsuru-page-spacing);
  border-radius: var(--vtsuru-page-radius);
}
.block.layout {
  padding: 0;
}
</style>
