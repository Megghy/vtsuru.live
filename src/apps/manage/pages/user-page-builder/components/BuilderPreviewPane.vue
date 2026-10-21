<script setup lang="ts">
import {
  CodeSlashOutline,
  DesktopOutline,
  HandLeftOutline,
  NavigateOutline,
  OpenOutline,
  OptionsOutline,
  PhonePortraitOutline,
  TabletPortraitOutline,
} from '@vicons/ionicons5'
import { useNow } from '@vueuse/core'
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'

import { fetchBiliProfile } from '@/apps/user-page/api'
import {
  getPageBackgroundCssVars,
  getUserPageThemeCssVars,
  resolvePageBackground,
} from '@/apps/user-page/background'
import BlockPageRenderer from '@/apps/user-page/block/BlockPageRenderer.vue'
import { usePageCanvasColor } from '@/apps/user-page/canvasColor'
import { useGoogleFont } from '@/apps/user-page/googleFonts'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import { IndexTemplateMap } from '@/shared/config/templates'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { isDarkMode } from '@/shared/utils'

import { UserPageEditorKey } from '../context'
import PhonePreview from './PhonePreview.vue'
import type { PreviewViewport } from './PhonePreview.vue'

defineOptions({ name: 'BuilderPreviewPane' })

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const viewport = ref<PreviewViewport>('desktop')
const previewRoot = ref<HTMLElement | null>(null)
const previewMode = ref<'select' | 'interact'>('select')
const simulatedLiveState = ref<'actual' | 'live' | 'offline'>('actual')
const simulatedNow = ref<number | null>(null)
const legacyIndexTemplate = computed(
  () =>
    IndexTemplateMap[editor.account.value?.settings.indexTemplate || 'default']?.component ??
    IndexTemplateMap.default.component,
)
const actualNow = useNow({ interval: 30_000 })
const viewportOptions: Array<{ value: PreviewViewport; label: string; icon: typeof PhonePortraitOutline }> = [
  { value: 'phone', label: '手机', icon: PhonePortraitOutline },
  { value: 'tablet', label: '平板', icon: TabletPortraitOutline },
  { value: 'desktop', label: '桌面', icon: DesktopOutline },
]

const biliProfileQuery = useUserPageRuntimeQuery<any | null>({
  key: () => `bili-profile:${editor.account.value?.biliId ?? ''}`,
  ttlMs: 60_000,
  loader: (signal) => fetchBiliProfile(editor.account.value!.biliId!, signal),
})
const biliProfileStatus = computed(() => {
  if (!editor.account.value?.biliId) return 'empty' as const
  if (biliProfileQuery.status.value === 'loading' || biliProfileQuery.status.value === 'idle') return 'loading' as const
  if (biliProfileQuery.status.value === 'error') return 'error' as const
  return biliProfileQuery.data.value ? ('ready' as const) : ('empty' as const)
})

async function loadBiliProfile() {
  if (!editor.account.value?.biliId) {
    biliProfileQuery.cancel()
    return
  }
  try {
    await biliProfileQuery.execute()
  } catch (error) {
    console.error('构建器预览加载B站资料失败', error)
  }
}

onMounted(() => {
  void loadBiliProfile()
})
watch(
  () => editor.account.value?.biliId,
  () => {
    void loadBiliProfile()
  },
)

const previewMergedTheme = computed(() => {
  const globalTheme = (editor.settings.value as any)?.theme ?? {}
  const pageTheme = (editor.currentPage.value as any)?.theme ?? {}
  const projectTheme = (editor.currentProject.value?.theme as any) ?? {}
  return { ...globalTheme, ...pageTheme, ...projectTheme }
})

useGoogleFont(
  computed(() =>
    typeof previewMergedTheme.value.fontFamily === 'string' ? previewMergedTheme.value.fontFamily : undefined,
  ),
)

const previewMergedProject = computed(() => {
  const p = editor.currentProject.value
  if (!p) return null
  return { ...p, theme: previewMergedTheme.value }
})

const previewEffectiveIsDark = computed(() => {
  const mode = (previewMergedTheme.value as any)?.pageThemeMode
  return resolvePageThemeIsDark(mode, isDarkMode.value)
})

const previewBg = computed(() => {
  const pageOverride = resolvePageBackground((editor.currentPage.value as any)?.background)
  if (pageOverride) return pageOverride
  const globalBg = resolvePageBackground((editor.settings.value as any)?.background)
  if (globalBg) return globalBg
  return resolvePageBackground(previewMergedProject.value?.theme)
})

const previewBgVars = computed(() => {
  const bg = previewBg.value
  if (!bg) return {}
  return getPageBackgroundCssVars(bg, previewEffectiveIsDark.value)
})

const previewCanvasColor = usePageCanvasColor(previewBg, previewEffectiveIsDark)
const previewUiVars = computed(() =>
  getUserPageThemeCssVars(previewMergedTheme.value, previewEffectiveIsDark.value, previewCanvasColor.value),
)

const previewBgClass = computed(() => ({
  'preview-bg-host': true,
  enabled: !!previewBg.value,
  glass: previewBg.value?.blurMode === 'glass',
  'bg-blur': previewBg.value?.blurMode === 'background',
}))
const previewHighlightBlockId = computed(() => editor.hoveredBlockId.value ?? editor.selectedBlockIds.value[0] ?? null)
const previewVisibilityContext = computed(() => ({
  isLive:
    simulatedLiveState.value === 'actual'
      ? (editor.account.value?.streamerInfo?.isStreaming ?? false)
      : simulatedLiveState.value === 'live',
  device: viewport.value === 'phone' ? ('mobile' as const) : ('desktop' as const),
  now: Math.floor((simulatedNow.value ?? actualNow.value.getTime()) / 1000),
}))

function selectPreviewBlock(blockId: string) {
  editor.selectedBlockIds.value = [blockId]
  editor.hoveredBlockId.value = blockId
}

watch(
  () => [editor.currentKey.value, editor.selectedBlockIds.value[0]] as const,
  async ([, blockId]) => {
    if (!blockId) return
    await nextTick()
    const target = Array.from(previewRoot.value?.querySelectorAll<HTMLElement>('[data-block-id]') ?? []).find(
      (element) => element.dataset.blockId === blockId,
    )
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  },
)
</script>

<template>
  <Card class="pane-card w-full h-full flex flex-col border border-border">
    <CardHeader class="p-3 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0">
      <CardTitle class="text-sm font-semibold truncate max-w-[200px]">
        预览 - {{ editor.currentLabel.value }}
      </CardTitle>

      <div class="flex items-center gap-1.5">
        <div class="flex items-center bg-muted p-0.5 rounded-lg">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="sm"
                  :variant="previewMode === 'select' ? 'default' : 'ghost'"
                  class="size-7 p-0"
                  aria-label="选择区块"
                  @click="previewMode = 'select'"
                >
                  <component :is="NavigateOutline" class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent class="text-xs">选择区块</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="sm"
                  :variant="previewMode === 'interact' ? 'default' : 'ghost'"
                  class="size-7 p-0"
                  aria-label="操作页面"
                  @click="previewMode = 'interact'"
                >
                  <component :is="HandLeftOutline" class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent class="text-xs">操作页面</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div class="flex items-center bg-muted p-0.5 rounded-lg">
          <TooltipProvider
            v-for="option in viewportOptions"
            :key="option.value"
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="sm"
                  :variant="viewport === option.value ? 'default' : 'ghost'"
                  class="size-7 p-0"
                  :aria-label="`${option.label}预览`"
                  @click="viewport = option.value"
                >
                  <component :is="option.icon" class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent class="text-xs">{{ option.label }}预览</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Popover>
          <PopoverTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="size-7 p-0"
              aria-label="预览条件"
            >
              <component :is="OptionsOutline" class="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-64 p-3 text-xs flex flex-col gap-2.5">
            <div class="flex flex-col gap-1">
              <label class="text-muted-foreground font-medium">直播状态</label>
              <Select v-model="simulatedLiveState">
                <SelectTrigger class="h-7 text-xs">
                  <SelectValue placeholder="直播状态" />
                </SelectTrigger>
                <SelectContent class="text-xs">
                  <SelectItem value="actual">使用真实状态</SelectItem>
                  <SelectItem value="live">模拟直播中</SelectItem>
                  <SelectItem value="offline">模拟未开播</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="size-7 p-0"
                aria-label="在真实页面中预览草稿"
                @click="editor.openPreview"
              >
                <component :is="OpenOutline" class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent class="text-xs">在真实页面中预览草稿</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </CardHeader>

    <CardContent
      ref="previewRoot"
      class="p-0 flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col"
    >
      <PhonePreview
        :style="[previewUiVars, previewBgVars]"
        :is-dark="previewEffectiveIsDark"
        :transparent="!!previewBg"
        :viewport="viewport"
      >
        <template #background>
          <div :class="previewBgClass" />
        </template>

        <Transition
          name="fade-slide"
          mode="out-in"
        >
          <div
            :key="
              editor.currentPage.value.mode === 'block' && editor.currentProject.value
                ? 'block'
                : editor.currentPage.value.mode
            "
            class="preview-content"
          >
            <template v-if="editor.currentPage.value.mode === 'block' && previewMergedProject">
              <div :class="{ 'preview-glass-surface': previewBg?.blurMode === 'glass' }">
                <BlockPageRenderer
                  :project="previewMergedProject"
                  :user-info="editor.account.value"
                  :bili-info="biliProfileQuery.data.value"
                  :bili-status="biliProfileStatus"
                  :is-dark="previewEffectiveIsDark"
                  :canvas-color="previewCanvasColor"
                  :highlight-block-id="previewHighlightBlockId"
                  :selected-block-ids="editor.selectedBlockIds.value"
                  :editor-mode="previewMode"
                  :visibility-context="previewVisibilityContext"
                  @select-block="selectPreviewBlock"
                  @hover-block="editor.hoveredBlockId.value = $event"
                />
              </div>
            </template>
            <template v-else-if="editor.currentPage.value.mode === 'legacy'">
              <component
                :is="legacyIndexTemplate"
                :user-info="editor.account.value as any"
                :bili-info="biliProfileQuery.data.value"
              />
            </template>
            <template v-else-if="editor.currentPage.value.mode === 'contrib'">
              <div class="contrib-preview-placeholder flex items-center justify-center min-h-[320px] p-6">
                <div class="contrib-placeholder-card flex flex-col items-center text-center max-w-sm p-6 rounded-xl border border-dashed border-border bg-muted">
                  <component
                    :is="CodeSlashOutline"
                    class="size-10 text-primary mb-2"
                  />
                  <div class="text-sm font-semibold mb-1">
                    扩展组件页 · {{ editor.currentContrib.value?.pageId || '未配置 pageId' }}
                  </div>
                  <div class="text-xs text-muted-foreground leading-relaxed">
                    扩展组件是由社区或专属代码渲染的独立页面。请在右侧面板配置 pageId 与相关属性，保存后可在外部预览中查看实际渲染效果。
                  </div>
                  <div class="flex justify-center mt-3.5">
                    <Button
                      size="sm"
                      class="text-xs"
                      @click="editor.openPreview"
                    >
                      <component :is="OpenOutline" class="size-3.5 mr-1" />
                      在对外页面中预览
                    </Button>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <Alert class="text-xs py-2 m-4">
                <AlertDescription>
                  当前页模式：{{ editor.getPageModeLabel(editor.currentPage.value.mode) }}
                </AlertDescription>
              </Alert>
            </template>
          </div>
        </Transition>
      </PhonePreview>
    </CardContent>
  </Card>
</template>

<style scoped>
.preview-pane-content {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
