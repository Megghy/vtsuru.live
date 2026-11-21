<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import {
  Code2,
  ExternalLink,
  Hand,
  Home,
  Maximize2,
  Minimize2,
  Monitor,
  MousePointer2,
  PanelLeft,
  Scaling,
  SlidersHorizontal,
  Smartphone,
  Tablet,
} from 'lucide-vue-next'
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'

import { fetchBiliProfile } from '@/apps/user-page/api'
import BlockPageRenderer from '@/apps/user-page/block/BlockPageRenderer.vue'
import CustomPageRenderer from '@/apps/user-page/components/CustomPageRenderer.vue'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import { IndexTemplateMap } from '@/shared/config/templates'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import { UserPageEditorKey } from '../context'
import { usePreviewThemeContext, useScopedCustomCssPreview } from '../previewThemeContext'
import PhonePreview from './PhonePreview.vue'
import type { PreviewViewport } from './PhonePreview.vue'

defineOptions({ name: 'BuilderPreviewPane' })

const props = withDefaults(
  defineProps<{
    focusPreview?: boolean
    canFocusPreview?: boolean
  }>(),
  {
    focusPreview: false,
    canFocusPreview: false,
  },
)

const emit = defineEmits<{
  (e: 'toggle-focus-preview'): void
}>()

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const viewport = ref<PreviewViewport>('desktop')
const fitDesktop = ref(true)
const previewRoot = ref<HTMLElement | null>(null)
const previewMode = ref<'select' | 'interact'>('select')
const simulatedLiveState = ref<'actual' | 'live' | 'offline'>('actual')
const simulatedNow = ref<number | null>(null)
const showPublicShell = ref(false)

const legacyIndexTemplate = computed(
  () =>
    IndexTemplateMap[editor.account.value?.settings.indexTemplate || 'default']?.component ??
    IndexTemplateMap.default.component,
)
const actualNow = useNow({ scheduler: (cb) => useIntervalFn(cb, 30_000) })

const simulatedNowInput = computed({
  get() {
    if (simulatedNow.value === null) return ''
    const d = new Date(simulatedNow.value)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  },
  set(raw: string) {
    const s = raw.trim()
    if (!s) {
      simulatedNow.value = null
      return
    }
    const ms = Date.parse(s)
    simulatedNow.value = Number.isFinite(ms) ? ms : null
  },
})

const hasActiveSimulation = computed(
  () => simulatedLiveState.value !== 'actual' || simulatedNow.value !== null || showPublicShell.value,
)

const isImmersiveCustom = computed(
  () => editor.currentPage.value.mode === 'custom' && editor.currentPage.value.custom?.immersive === true,
)

const viewportOptions = [
  { value: 'phone' as PreviewViewport, label: '手机', icon: Smartphone },
  { value: 'tablet' as PreviewViewport, label: '平板', icon: Tablet },
  { value: 'desktop' as PreviewViewport, label: '桌面', icon: Monitor },
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

const {
  mergedTheme: previewMergedTheme,
  effectiveIsDark: previewEffectiveIsDark,
  resolvedBackground: previewBg,
  canvasColor: previewCanvasColor,
  bgVars: previewBgVars,
  uiVars: previewUiVars,
  customCss: previewCustomCss,
} = usePreviewThemeContext({
  settings: () => editor.settings.value,
  currentPage: () => editor.currentPage.value,
  currentProject: () => editor.currentProject.value,
})

useScopedCustomCssPreview('.builder-preview-custom-css-scope', previewCustomCss)

const previewMergedProject = computed(() => {
  const p = editor.currentProject.value
  if (!p) return null
  return { ...p, theme: previewMergedTheme.value }
})

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
  <Card class="pane-card w-full h-full flex flex-col">
    <CardHeader class="h-10 px-3 py-0 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0">
      <CardTitle class="text-xs font-semibold truncate max-w-[180px]">
        预览 · {{ editor.currentLabel.value }}
      </CardTitle>

      <div class="flex items-center gap-1.5">
        <ToggleGroup
          type="single"
          size="xs"
          :model-value="previewMode"
          @update:model-value="
            (val) => {
              if (val === 'select' || val === 'interact') previewMode = val
            }
          "
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <ToggleGroupItem
                  value="select"
                  aria-label="选择区块"
                >
                  <MousePointer2 class="size-3.5" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>选择区块</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <ToggleGroupItem
                  value="interact"
                  aria-label="操作页面"
                >
                  <Hand class="size-3.5" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>操作页面</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ToggleGroup>

        <ToggleGroup
          type="single"
          size="xs"
          :model-value="viewport"
          @update:model-value="
            (val) => {
              if (val === 'phone' || val === 'tablet' || val === 'desktop') viewport = val
            }
          "
        >
          <TooltipProvider
            v-for="option in viewportOptions"
            :key="option.value"
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <ToggleGroupItem
                  :value="option.value"
                  :aria-label="`${option.label}预览`"
                >
                  <component
                    :is="option.icon"
                    class="size-3.5"
                  />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{{ option.label }}预览</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ToggleGroup>

        <TooltipProvider v-if="viewport === 'desktop'">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                :variant="fitDesktop ? 'secondary' : 'ghost'"
                aria-label="切换桌面端缩放适配"
                @click="fitDesktop = !fitDesktop"
              >
                <Scaling class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{
                fitDesktop
                  ? '当前：按 1180px 桌面视口等比缩放（点击切换 1:1 容器流式）'
                  : '当前：1:1 容器流式宽度（点击切换 1180px 等比缩放）'
              }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider v-if="props.canFocusPreview">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                :variant="props.focusPreview ? 'default' : 'ghost'"
                :aria-label="props.focusPreview ? '退出专注预览' : '专注预览'"
                @click="emit('toggle-focus-preview')"
              >
                <Minimize2
                  v-if="props.focusPreview"
                  class="size-3.5"
                />
                <Maximize2
                  v-else
                  class="size-3.5"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ props.focusPreview ? '退出专注预览' : '专注预览' }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Popover>
          <PopoverTrigger as-child>
            <Button
              size="icon-xs"
              :variant="hasActiveSimulation ? 'secondary' : 'ghost'"
              aria-label="预览条件"
            >
              <SlidersHorizontal class="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            class="w-72 flex flex-col gap-3 p-3"
          >
            <FormField label="模拟直播状态">
              <Select v-model="simulatedLiveState">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="直播状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="actual">使用真实状态</SelectItem>
                  <SelectItem value="live">模拟直播中</SelectItem>
                  <SelectItem value="offline">模拟未开播</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="模拟时间（测试定时显隐区块）"
              description="留空表示使用当前真实时间"
            >
              <div class="flex items-center gap-1.5">
                <Input
                  v-model="simulatedNowInput"
                  type="datetime-local"
                  class="flex-1 min-w-0"
                />
                <Button
                  v-if="simulatedNow !== null"
                  variant="ghost"
                  size="xs"
                  @click="simulatedNow = null"
                >
                  重置
                </Button>
              </div>
            </FormField>

            <SettingRow
              title="显示公开页导航壳子"
              description="预览顶栏/侧栏及沉浸模式 Dock 占位"
              variant="none"
            >
              <Switch v-model:checked="showPublicShell" />
            </SettingRow>
          </PopoverContent>
        </Popover>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="在真实页面中预览草稿"
                @click="editor.openPreview"
              >
                <ExternalLink class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>在新标签页预览草稿</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </CardHeader>

    <CardContent class="p-0 flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
      <div
        ref="previewRoot"
        class="contents"
      >
        <PhonePreview
          class="builder-preview-custom-css-scope"
          :style="[previewUiVars, previewBgVars]"
          :is-dark="previewEffectiveIsDark"
          :transparent="!!previewBg"
          :viewport="viewport"
          :fit-desktop="fitDesktop"
        >
          <template #background>
            <div :class="previewBgClass" />
          </template>

          <!-- 可选：真实公开页顶栏 / 侧栏壳子占位 -->
          <div
            v-if="showPublicShell && !isImmersiveCustom"
            class="sticky top-0 z-20 flex items-center justify-between px-3 h-10 border-b border-border bg-background/80 backdrop-blur-md text-xs text-muted-foreground select-none pointer-events-none"
          >
            <div class="flex items-center gap-2 font-semibold text-foreground">
              <PanelLeft class="size-3.5 text-primary" />
              <span>VTSURU · @{{ editor.account.value.name || 'streamer' }}</span>
            </div>
            <span>公开页顶栏占位</span>
          </div>

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
              class="preview-content relative"
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
              <CustomPageRenderer
                v-else-if="editor.currentPage.value.mode === 'custom' && editor.currentPage.value.custom"
                :config="editor.currentPage.value.custom"
                :page-slug="editor.currentKey.value === 'home' ? null : editor.currentKey.value"
                :user-info="editor.account.value"
                :bili-info="biliProfileQuery.data.value ?? undefined"
              />
              <template v-else-if="editor.currentPage.value.mode === 'legacy'">
                <component
                  :is="legacyIndexTemplate"
                  :user-info="editor.account.value as any"
                  :bili-info="biliProfileQuery.data.value"
                />
              </template>
              <template v-else-if="editor.currentPage.value.mode === 'contrib'">
                <div class="contrib-preview-placeholder flex-center min-h-[320px] p-6">
                  <div
                    class="contrib-placeholder-card flex flex-col items-center text-center max-w-sm p-6 rounded-xl border border-dashed border-border bg-muted"
                  >
                    <Code2 class="size-10 text-primary mb-2" />
                    <div class="text-sm font-semibold mb-1">
                      扩展组件页 · {{ editor.currentContrib.value?.pageId || '未配置 pageId' }}
                    </div>
                    <div class="text-xs text-muted-foreground leading-relaxed">
                      扩展组件是由社区或专属代码渲染的独立页面。请在右侧面板配置 pageId
                      与相关属性，保存后可在外部预览中查看实际渲染效果。
                    </div>
                    <div class="flex justify-center mt-3.5">
                      <Button
                        class="gap-1.5"
                        @click="editor.openPreview"
                      >
                        <ExternalLink class="size-3.5" />
                        在对外页面中预览
                      </Button>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else>
                <Alert class="m-4">
                  <AlertDescription>
                    当前页模式：{{ editor.getPageModeLabel(editor.currentPage.value.mode) }}
                  </AlertDescription>
                </Alert>
              </template>

              <!-- 沉浸模式 Dock 占位提示 -->
              <div
                v-if="showPublicShell && isImmersiveCustom"
                class="pointer-events-none fixed bottom-4 right-4 z-30 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/85 backdrop-blur-md px-3 py-1.5 text-xs text-foreground shadow-md"
              >
                <Home class="size-3.5 text-primary" />
                <span>沉浸模式悬浮 Dock 占位</span>
              </div>
            </div>
          </Transition>
        </PhonePreview>
      </div>
    </CardContent>
  </Card>
</template>
