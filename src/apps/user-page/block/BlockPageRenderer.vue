<script setup lang="ts">
import { useMediaQuery, useNow } from '@vueuse/core'
import { computed, provide } from 'vue'

import type { UserInfo } from '@/api/api-models'
import { getUserPageThemeCssVars } from '@/apps/user-page/background'
import { provideThemeScope } from '@/shared/config/theme/scope'

import type { BiliProfileStatus } from '../types'
import { BLOCK_COMPONENTS } from './registry'
import type { BlockPageProject, BlockVisibilityContext } from './schema'
import { collectPageSections, PageSectionsKey } from './sectionNavigation'
import { isBlockVisible } from './visibility'

const props = defineProps<{
  project: BlockPageProject
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  biliStatus?: BiliProfileStatus
  isDark: boolean
  canvasColor?: string
  highlightBlockId?: string | null
  selectedBlockIds?: string[]
  editorMode?: 'select' | 'interact'
  visibilityContext?: BlockVisibilityContext
}>()

const emit = defineEmits<{
  (event: 'select-block', blockId: string): void
  (event: 'hover-block', blockId: string | null): void
}>()

const userThemeVars = computed(() => getUserPageThemeCssVars(props.project.theme, props.isDark, props.canvasColor))
provideThemeScope(userThemeVars)

const blockComponents = BLOCK_COMPONENTS
const isMobile = useMediaQuery('(max-width: 767px)')
const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 30_000) })
const activeVisibilityContext = computed<BlockVisibilityContext>(
  () =>
    props.visibilityContext ?? {
      isLive: props.userInfo?.streamerInfo?.isStreaming ?? false,
      device: isMobile.value ? 'mobile' : 'desktop',
      now: Math.floor(now.value.getTime() / 1000),
    },
)
const renderedBlocks = computed(() =>
  props.editorMode
    ? props.project.blocks
    : props.project.blocks.filter((block) => !block.hidden && isBlockVisible(block, activeVisibilityContext.value)),
)
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
  <div
    class="page w-full mx-auto flex flex-col bg-transparent max-w-[var(--vtsuru-page-max-width,820px)] py-[var(--vtsuru-page-spacing)] gap-[var(--vtsuru-page-spacing)] text-foreground font-[family-name:var(--vtsuru-page-font-family,inherit)]"
    :style="userThemeVars"
  >
    <div
      v-for="block in renderedBlocks"
      :key="block.id"
      class="block relative min-w-0"
      :class="{
        highlight: !!props.highlightBlockId && props.highlightBlockId === block.id,
        'outline outline-1 outline-offset-2 outline-primary/55': !!props.highlightBlockId && props.highlightBlockId === block.id,
        'outline outline-2 outline-offset-[3px] outline-primary': selectedBlockIdSet.has(block.id),
        hidden: block.hidden,
        unavailable: props.editorMode && !block.hidden && !isBlockVisible(block, activeVisibilityContext),
        'min-h-11 opacity-40': block.hidden || (props.editorMode && !block.hidden && !isBlockVisible(block, activeVisibilityContext)),
        'cursor-pointer': props.editorMode === 'select',
        '[&_iframe]:pointer-events-none': props.editorMode === 'select',
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
        v-bind="
          block.type === 'layout'
            ? {
                highlightBlockId: props.highlightBlockId,
                selectedBlockIds: props.selectedBlockIds,
                editorMode: props.editorMode,
                visibilityContext: activeVisibilityContext,
                onSelectBlock: (id: string) => emit('select-block', id),
                onHoverBlock: (id: string | null) => emit('hover-block', id),
              }
            : {}
        "
      />
    </div>
  </div>
</template>

<style scoped>
.block.hidden::before,
.block.unavailable::before {
  content: attr(data-block-overlay);
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  border: 1px dashed var(--primary);
  color: var(--foreground);
  background: color-mix(in srgb, var(--background) 72%, transparent);
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
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 45%, transparent);
  color: var(--foreground);
  pointer-events: none;
  user-select: none;
}
</style>
