<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import type { GlobalThemeOverrides } from 'naive-ui'
import { darkTheme, NConfigProvider } from 'naive-ui';
import { computed } from 'vue'
import type { BlockPageProject } from './schema'
import { BLOCK_COMPONENTS } from './registry'
import { hexToRgba } from '@/shared/utils'
import { getThemeOverrides } from '@/shared/config/theme'

const props = defineProps<{
  project: BlockPageProject
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  extraThemeOverrides?: GlobalThemeOverrides
  highlightBlockId?: string | null
}>()

// 用户页忽略系统亮暗：除非显式设置为 light，否则默认按 dark 渲染
const isDark = computed(() => (props.project.theme as any)?.pageThemeMode !== 'light')
const baseOverrides = computed(() => getThemeOverrides(isDark.value))

const radius = computed(() => props.project.theme?.radius ?? 6) // Default to 6 (shadcn default)
const spacing = computed(() => {
  const v = props.project.theme?.spacing ?? 'normal'
  if (v === 'compact') return 10
  if (v === 'relaxed') return 20
  return 16
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
  '--vtsuru-card-border-color': isDark.value ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.10)',
  ...(pageMaxWidth.value ? { '--vtsuru-page-max-width': pageMaxWidth.value } : {}),
}))

const naiveTheme = computed(() => {
  if (isDark.value) return darkTheme
  return null
})

// Specific overrides from the "Builder" UI
const userOverrides = computed<GlobalThemeOverrides>(() => {
  const t: any = props.project.theme ?? {}
  const primaryColor = typeof t.primaryColor === 'string' ? t.primaryColor : undefined
  const textColor = typeof t.textColor === 'string' ? t.textColor : undefined
  const bodyColor = typeof t.backgroundColor === 'string' ? t.backgroundColor : undefined
  const radiusPx = `${radius.value}px`
  const borderColor = textColor ? hexToRgba(textColor, 0.16) : null

  return {
    common: {
      ...(primaryColor ? { primaryColor, primaryColorHover: primaryColor, primaryColorPressed: primaryColor } : {}),
      ...(textColor ? { textColorBase: textColor, textColor1: textColor, textColor2: textColor, textColor3: textColor } : {}),
      ...(bodyColor ? { bodyColor, cardColor: bodyColor, modalColor: bodyColor, popoverColor: bodyColor } : {}),
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
    // Reset specific component radius to match page setting if needed,
    // although theme.ts has good defaults. We only override if necessary.
    Card: {
      borderRadius: radiusPx,
    },
  }
})

// Deep merge: Base (theme.ts) <- User (Builder) <- Extra (Props)
const mergedThemeOverrides = computed<GlobalThemeOverrides>(() => {
  const sources = [baseOverrides.value, userOverrides.value, props.extraThemeOverrides ?? {}]

  // Simple deep merge for 2 levels (common, Button, etc.)
  const result: any = {}

  for (const source of sources) {
    if (!source) continue
    for (const key of Object.keys(source)) {
      const val = (source as any)[key]
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
         result[key] = { ...(result[key] ?? {}), ...val }
      } else {
         result[key] = val
      }
    }
  }

  return result as GlobalThemeOverrides
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
        :class="{ layout: block.type === 'layout', highlight: !!props.highlightBlockId && props.highlightBlockId === block.id }"
        :data-block-id="block.id"
        :data-block-type="block.type"
      >
        <component
          :is="blockComponents[block.type]"
          v-if="!block.hidden"
          :block-props="block.props"
          :user-info="userInfo"
          :bili-info="biliInfo"
          v-bind="block.type === 'layout' ? { highlightBlockId: props.highlightBlockId } : {}"
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
  padding: var(--vtsuru-page-spacing) 0 var(--vtsuru-page-spacing) 0;
  display: flex;
  flex-direction: column;
  gap: var(--vtsuru-page-spacing);
  color: var(--vtsuru-page-text);
  background: var(--vtsuru-page-bg);
}
.block {
  min-width: 0;
  position: relative;
}
.block.layout {
  padding: 0;
}

.block.highlight {
  outline: 1px solid color-mix(in srgb, var(--vtsuru-page-primary) 55%, transparent);
  outline-offset: 2px;
}

.block.highlight::after {
  content: attr(data-block-type);
  position: absolute;
  top: -10px;
  left: 10px;
  padding: 2px 8px;
  font-size: 11px;
  line-height: 16px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--vtsuru-page-primary) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--vtsuru-page-primary) 45%, transparent);
  color: var(--vtsuru-page-text);
  pointer-events: none;
  user-select: none;
}
</style>
