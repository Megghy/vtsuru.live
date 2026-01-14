<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import type { GlobalThemeOverrides } from 'naive-ui'
import { darkTheme, NConfigProvider } from 'naive-ui'
import { computed } from 'vue'
import type { BlockPageProject } from './schema'
import { BLOCK_COMPONENTS } from './registry'
import { hexToRgba } from '@/shared/utils'

const props = defineProps<{
  project: BlockPageProject
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  extraThemeOverrides?: GlobalThemeOverrides
}>()

const radius = computed(() => props.project.theme?.radius ?? 12)
const spacing = computed(() => {
  const v = props.project.theme?.spacing ?? 'normal'
  if (v === 'compact') return 10
  if (v === 'relaxed') return 18
  return 14
})
const pageMaxWidth = computed(() => {
  const v = (props.project.theme as any)?.pageMaxWidth
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length ? s : null
})
const containerStyle = computed(() => ({
  '--vtsuru-page-radius': `${radius.value}px`,
  '--vtsuru-page-spacing': `${spacing.value}px`,
  '--vtsuru-page-primary': props.project.theme?.primaryColor ?? 'var(--n-color)',
  '--vtsuru-page-bg': props.project.theme?.backgroundColor ?? 'transparent',
  '--vtsuru-page-text': props.project.theme?.textColor ?? 'inherit',
  ...(pageMaxWidth.value ? { '--vtsuru-page-max-width': pageMaxWidth.value } : {}),
}))

const naiveTheme = computed(() => {
  const mode = (props.project.theme as any)?.pageThemeMode
  if (mode === 'dark') return darkTheme
  if (mode === 'light') return null
  return undefined
})

const themeOverrides = computed<GlobalThemeOverrides>(() => {
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
  }
})

const mergedThemeOverrides = computed<GlobalThemeOverrides>(() => {
  const base = themeOverrides.value
  const extra = props.extraThemeOverrides ?? {}
  const merged: Record<string, any> = { ...base, ...extra }

  const keys = new Set<string>([...Object.keys(base as any), ...Object.keys(extra as any)])
  keys.forEach((k) => {
    const a = (base as any)[k]
    const b = (extra as any)[k]
    if (!a || typeof a !== 'object' || Array.isArray(a)) return
    if (!b || typeof b !== 'object' || Array.isArray(b)) return
    merged[k] = { ...a, ...b }
  })

  return merged as GlobalThemeOverrides
})

const blockComponents = BLOCK_COMPONENTS
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="mergedThemeOverrides">
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
  width: 100%;
  max-width: var(--vtsuru-page-max-width, 820px);
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
