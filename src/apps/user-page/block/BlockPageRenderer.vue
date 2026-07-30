<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import type { GlobalThemeOverrides } from 'naive-ui'
import { darkTheme, NConfigProvider } from 'naive-ui';
import { computed, provide } from 'vue'
import { useMediaQuery, useNow } from '@vueuse/core'
import type { BlockPageProject, BlockVisibilityContext } from './schema'
import type { BiliProfileStatus } from '../types'
import { BLOCK_COMPONENTS } from './registry'
import { getUserPageNaiveThemeOverrides, getUserPageThemeCssVars } from '@/apps/user-page/background'
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

const userThemeVars = computed(() => getUserPageThemeCssVars(props.project.theme, props.isDark))

const naiveTheme = computed(() => {
  if (props.isDark) return darkTheme
  return null
})

// Specific overrides from the "Builder" UI
const userOverrides = computed<GlobalThemeOverrides>(() => (
  getUserPageNaiveThemeOverrides(props.project.theme, userThemeVars.value, props.isDark)
))

// 展示页主题是完整基底，外部只允许追加预览态覆盖。
const mergedThemeOverrides = computed<GlobalThemeOverrides>(() => {
  const sources = [userOverrides.value, props.extraThemeOverrides ?? {}]

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
      :style="userThemeVars"
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
  font-family: var(--vtsuru-page-font-family);
  max-width: var(--vtsuru-page-max-width, 820px);
  margin: 0 auto;
  padding: var(--vtsuru-page-spacing) 0 var(--vtsuru-page-spacing) 0;
  display: flex;
  flex-direction: column;
  gap: var(--vtsuru-page-spacing);
  color: var(--vtsuru-page-text);
  background: transparent;
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
