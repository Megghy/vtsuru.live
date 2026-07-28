<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import type { GlobalThemeOverrides } from 'naive-ui'
import { darkTheme, NConfigProvider } from 'naive-ui';
import { computed, provide } from 'vue'
import { useMediaQuery, useNow } from '@vueuse/core'
import type { BlockPageProject, BlockVisibilityContext } from './schema'
import type { BiliProfileStatus } from '../types'
import { BLOCK_COMPONENTS } from './registry'
import { getUserPageSurfaceCssVars } from '@/apps/user-page/background'
import { buildTokens, getThemeCssVars, getThemeOverrides } from '@/shared/config/theme'
import { isBlockVisible } from './visibility'
import { collectPageSections, PageSectionsKey } from './sectionNavigation'

const props = defineProps<{
  project: BlockPageProject
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  biliStatus?: BiliProfileStatus
  isDark: boolean
  extraThemeOverrides?: GlobalThemeOverrides
  highlightBlockId?: string | null
  selectedBlockIds?: string[]
  editorMode?: 'select' | 'interact'
  visibilityContext?: BlockVisibilityContext
}>()

const emit = defineEmits<{
  (event: 'select-block', blockId: string): void
  (event: 'hover-block', blockId: string | null): void
}>()

const baseOverrides = computed(() => getThemeOverrides(props.isDark))
const surfaceTokens = computed(() => buildTokens(props.isDark))

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
  ...getThemeCssVars(surfaceTokens.value),
  ...getUserPageSurfaceCssVars(props.isDark),
  '--vtsuru-page-radius': `${radius.value}px`,
  '--vtsuru-page-spacing': `${spacing.value}px`,
  '--vtsuru-page-primary': props.project.theme?.primaryColor ?? 'var(--n-primary-color)',
  '--vtsuru-page-bg': props.project.theme?.backgroundColor ?? 'transparent',
  '--vtsuru-page-text': props.project.theme?.textColor ?? surfaceTokens.value.foreground,
  '--vtsuru-surface-fg': surfaceTokens.value.foreground,
  '--vtsuru-surface-fg-muted': 'color-mix(in srgb, var(--vtsuru-surface-fg) 76%, transparent)',
  '--vtsuru-surface-fg-subtle': 'color-mix(in srgb, var(--vtsuru-surface-fg) 60%, transparent)',
  ...(pageMaxWidth.value ? { '--vtsuru-page-max-width': pageMaxWidth.value } : {}),
}))

const naiveTheme = computed(() => {
  if (props.isDark) return darkTheme
  return null
})

// Specific overrides from the "Builder" UI
const userOverrides = computed<GlobalThemeOverrides>(() => {
  const t: any = props.project.theme ?? {}
  const primaryColor = typeof t.primaryColor === 'string' ? t.primaryColor : undefined
  const radiusPx = `${radius.value}px`

  return {
    common: {
      ...(primaryColor ? { primaryColor, primaryColorHover: primaryColor, primaryColorPressed: primaryColor } : {}),
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
         result[key] = { ...result[key], ...val }
      } else {
         result[key] = val
      }
    }
  }

  return result as GlobalThemeOverrides
})

const blockComponents = BLOCK_COMPONENTS
const isMobile = useMediaQuery('(max-width: 767px)')
const now = useNow({ interval: 30_000 })
const activeVisibilityContext = computed<BlockVisibilityContext>(() => props.visibilityContext ?? ({
  isLive: props.userInfo?.streamerInfo?.isStreaming ?? false,
  device: isMobile.value ? 'mobile' : 'desktop',
  now: Math.floor(now.value.getTime() / 1000),
}))
const renderedBlocks = computed(() => props.editorMode
  ? props.project.blocks
  : props.project.blocks.filter(block => !block.hidden && isBlockVisible(block, activeVisibilityContext.value)))
const selectedBlockIdSet = computed(() => new Set(props.selectedBlockIds ?? []))
const pageSections = computed(() => collectPageSections(props.project.blocks, activeVisibilityContext.value))
provide(PageSectionsKey, pageSections)

function handleBlockClick(event: MouseEvent, blockId: string) {
  if (props.editorMode !== 'select') return
  event.preventDefault()
  event.stopPropagation()
  emit('select-block', blockId)
}
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="mergedThemeOverrides">
    <div
      class="page"
      :style="containerStyle"
    >
      <div
        v-for="block in renderedBlocks"
        :key="block.id"
        class="block"
        :class="{
          layout: block.type === 'layout',
          highlight: !!props.highlightBlockId && props.highlightBlockId === block.id,
          selected: selectedBlockIdSet.has(block.id),
          hidden: block.hidden,
          unavailable: props.editorMode && !block.hidden && !isBlockVisible(block, activeVisibilityContext),
          selectable: props.editorMode === 'select',
        }"
        :data-block-overlay="block.hidden ? '已隐藏' : '当前预览条件下不显示'"
        :data-block-id="block.id"
        :data-block-type="block.type"
        @click="handleBlockClick($event, block.id)"
        @mouseenter="props.editorMode && emit('hover-block', block.id)"
        @mouseleave="props.editorMode && emit('hover-block', null)"
      >
        <component
          :is="blockComponents[block.type]"
          :block-props="block.props"
          :user-info="userInfo"
          :bili-info="biliInfo"
          :bili-status="biliStatus"
          :block-id="block.type === 'heading' ? block.id : undefined"
          v-bind="block.type === 'layout' ? {
            highlightBlockId: props.highlightBlockId,
            selectedBlockIds: props.selectedBlockIds,
            editorMode: props.editorMode,
            visibilityContext: activeVisibilityContext,
            onSelectBlock: (id: string) => emit('select-block', id),
            onHoverBlock: (id: string | null) => emit('hover-block', id),
          } : {}"
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

.block.selected {
  outline: 2px solid var(--vtsuru-page-primary);
  outline-offset: 3px;
}

.block.selectable {
  cursor: pointer;
}

.block.hidden,
.block.unavailable {
  min-height: 44px;
  opacity: 0.42;
}

.block.selectable :deep(iframe) {
  pointer-events: none;
}

.block.hidden::before,
.block.unavailable::before {
  content: attr(data-block-overlay);
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  border: 1px dashed var(--vtsuru-page-primary);
  color: var(--vtsuru-page-text);
  background: color-mix(in srgb, var(--vtsuru-page-bg) 72%, transparent);
  pointer-events: none;
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
