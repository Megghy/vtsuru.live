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
import type { GlobalThemeOverrides } from 'naive-ui'
import {
  darkTheme,
  NAlert,
  NButton,
  NButtonGroup,
  NCard,
  NConfigProvider,
  NDatePicker,
  NFlex,
  NForm,
  NFormItem,
  NIcon,
  NPopover,
  NSelect,
  NTooltip,
} from 'naive-ui'
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'

import { fetchBiliProfile } from '@/apps/user-page/api'
import {
  getPageBackgroundCssVars,
  getUserPageNaiveThemeOverrides,
  getUserPageThemeCssVars,
  resolvePageBackground,
} from '@/apps/user-page/background'
import BlockPageRenderer from '@/apps/user-page/block/BlockPageRenderer.vue'
import { usePageCanvasColor } from '@/apps/user-page/canvasColor'
import { useGoogleFont } from '@/apps/user-page/googleFonts'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import { IndexTemplateMap } from '@/shared/config/templates'
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

const previewNaiveTheme = computed(() => (previewEffectiveIsDark.value ? darkTheme : null))

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

const previewUserThemeOverrides = computed<GlobalThemeOverrides>(() => {
  return getUserPageNaiveThemeOverrides(previewMergedTheme.value, previewUiVars.value, previewEffectiveIsDark.value)
})

const previewSurfaceThemeOverrides = computed<GlobalThemeOverrides>(() => {
  const bg = previewBg.value
  if (!bg || bg.blurMode === 'none') return {}
  const vars = previewUiVars.value
  const borderColor = vars['--vtsuru-card-border-color'] ?? vars['--user-page-border-color']
  return {
    common: {
      borderColor,
      dividerColor: borderColor,
    },
    List: {
      color: 'transparent',
      listItemColor: 'transparent',
      borderColor,
    },
  }
})

const previewThemeOverrides = computed<GlobalThemeOverrides>(() => {
  const user = previewUserThemeOverrides.value
  const surface = previewSurfaceThemeOverrides.value
  return {
    ...user,
    ...surface,
    common: { ...user.common, ...surface.common },
    Card: { ...user.Card, ...surface.Card },
    List: { ...user.List, ...surface.List },
  }
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
  <NCard
    class="pane-card"
    :title="`预览 - ${editor.currentLabel.value}`"
    content-style="display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden"
  >
    <template #header-extra>
      <NFlex
        align="center"
        :wrap="false"
        size="small"
      >
        <NButtonGroup size="small">
          <NTooltip>
            <template #trigger>
              <NButton
                :type="previewMode === 'select' ? 'primary' : 'default'"
                :secondary="previewMode === 'select'"
                aria-label="选择区块"
                @click="previewMode = 'select'"
              >
                <template #icon>
                  <NIcon><NavigateOutline /></NIcon>
                </template>
              </NButton>
            </template>
            选择区块
          </NTooltip>
          <NTooltip>
            <template #trigger>
              <NButton
                :type="previewMode === 'interact' ? 'primary' : 'default'"
                :secondary="previewMode === 'interact'"
                aria-label="操作页面"
                @click="previewMode = 'interact'"
              >
                <template #icon>
                  <NIcon><HandLeftOutline /></NIcon>
                </template>
              </NButton>
            </template>
            操作页面
          </NTooltip>
        </NButtonGroup>
        <NButtonGroup size="small">
          <NTooltip
            v-for="option in viewportOptions"
            :key="option.value"
          >
            <template #trigger>
              <NButton
                :type="viewport === option.value ? 'primary' : 'default'"
                :secondary="viewport === option.value"
                :aria-label="`${option.label}预览`"
                @click="viewport = option.value"
              >
                <template #icon>
                  <NIcon><component :is="option.icon" /></NIcon>
                </template>
              </NButton>
            </template>
            {{ option.label }}预览
          </NTooltip>
        </NButtonGroup>
        <NPopover
          trigger="click"
          placement="bottom-end"
        >
          <template #trigger>
            <NButton
              quaternary
              circle
              size="small"
              aria-label="预览条件"
            >
              <template #icon>
                <NIcon><OptionsOutline /></NIcon>
              </template>
            </NButton>
          </template>
          <NForm
            label-placement="top"
            size="small"
            style="width: 260px"
          >
            <NFormItem label="直播状态">
              <NSelect
                v-model:value="simulatedLiveState"
                :options="[
                  { label: '使用真实状态', value: 'actual' },
                  { label: '模拟直播中', value: 'live' },
                  { label: '模拟未开播', value: 'offline' },
                ]"
              />
            </NFormItem>
            <NFormItem label="预览时间">
              <NDatePicker
                v-model:value="simulatedNow"
                type="datetime"
                clearable
                style="width: 100%"
              />
            </NFormItem>
          </NForm>
        </NPopover>
        <NTooltip>
          <template #trigger>
            <NButton
              quaternary
              circle
              size="small"
              aria-label="在真实页面中预览草稿"
              @click="editor.openPreview"
            >
              <template #icon>
                <NIcon><OpenOutline /></NIcon>
              </template>
            </NButton>
          </template>
          在真实页面中预览草稿
        </NTooltip>
      </NFlex>
    </template>
    <div
      ref="previewRoot"
      class="preview-pane-content"
    >
      <NConfigProvider
        abstract
        :theme="null"
        :theme-overrides="null"
      >
        <NConfigProvider
          abstract
          :theme="previewNaiveTheme"
          :theme-overrides="previewThemeOverrides"
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
                      :extra-theme-overrides="previewSurfaceThemeOverrides"
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
                  <div class="contrib-preview-placeholder">
                    <div class="contrib-placeholder-card">
                      <NIcon
                        size="40"
                        :component="CodeSlashOutline"
                        style="color: var(--vtsuru-primary); margin-bottom: 8px"
                      />
                      <div class="contrib-placeholder-title">
                        扩展组件页 · {{ editor.currentContrib.value?.pageId || '未配置 pageId' }}
                      </div>
                      <div class="contrib-placeholder-desc">
                        扩展组件是由社区或专属代码渲染的独立页面。请在右侧面板配置 pageId 与相关属性，保存后可在外部预览中查看实际渲染效果。
                      </div>
                      <NFlex
                        justify="center"
                        style="margin-top: 14px"
                      >
                        <NButton
                          type="primary"
                          secondary
                          size="small"
                          @click="editor.openPreview"
                        >
                          <template #icon>
                            <NIcon><OpenOutline /></NIcon>
                          </template>
                          在对外页面中预览
                        </NButton>
                      </NFlex>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <NAlert
                    type="info"
                    :show-icon="true"
                  >
                    当前页模式：{{ editor.getPageModeLabel(editor.currentPage.value.mode) }}
                  </NAlert>
                </template>
              </div>
            </Transition>
          </PhonePreview>
        </NConfigProvider>
      </NConfigProvider>
    </div>
  </NCard>
</template>

<style scoped>
.preview-pane-content {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.contrib-preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: 24px;
}

.contrib-placeholder-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 380px;
  padding: 24px 20px;
  border-radius: 12px;
  border: 1px dashed var(--vtsuru-border);
  background: var(--vtsuru-bg-muted);
}

.contrib-placeholder-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  margin-bottom: 6px;
}

.contrib-placeholder-desc {
  font-size: 13px;
  line-height: 1.5;
  color: var(--vtsuru-fg-muted);
}
</style>
