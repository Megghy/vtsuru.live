<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'

import { fetchBiliProfile } from '@/apps/user-page/api'
import { getPageBackgroundCssVars, getUserPageThemeCssVars, resolvePageBackground } from '@/apps/user-page/background'
import BlockPageRenderer from '@/apps/user-page/block/BlockPageRenderer.vue'
import { useGoogleFont } from '@/apps/user-page/googleFonts'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import DefaultIndexTemplate from '@/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue'
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
const simulatedNowInput = computed({
  get: () => {
    if (simulatedNow.value === null) return ''
    const date = new Date(simulatedNow.value)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  },
  set: (value: string) => {
    simulatedNow.value = value ? new Date(value).getTime() : null
  },
})
const actualNow = useNow({ interval: 30_000 })
const viewportOptions: Array<{ value: PreviewViewport; label: string; icon: string }> = [
  { value: 'phone', label: '手机', icon: 'i-lucide-smartphone' },
  { value: 'tablet', label: '平板', icon: 'i-lucide-tablet' },
  { value: 'desktop', label: '桌面', icon: 'i-lucide-monitor' },
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

const previewUiVars = computed(() => getUserPageThemeCssVars(previewMergedTheme.value, previewEffectiveIsDark.value))

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
  <UCard class="pane-card">
    <template #header>
      <div class="preview-header">
        <strong>预览 - {{ editor.currentLabel.value }}</strong>
        <div class="builder-row">
          <UButtonGroup size="sm">
            <UTooltip text="选择区块">
              <UButton
                icon="i-lucide-mouse-pointer-2"
                :variant="previewMode === 'select' ? 'solid' : 'ghost'"
                square
                aria-label="选择区块"
                @click="previewMode = 'select'"
              />
            </UTooltip>
            <UTooltip text="操作页面">
              <UButton
                icon="i-lucide-hand"
                :variant="previewMode === 'interact' ? 'solid' : 'ghost'"
                square
                aria-label="操作页面"
                @click="previewMode = 'interact'"
              />
            </UTooltip>
          </UButtonGroup>
          <UButtonGroup size="sm">
            <UTooltip
              v-for="option in viewportOptions"
              :key="option.value"
              :text="`${option.label}预览`"
            >
              <UButton
                :icon="option.icon"
                :variant="viewport === option.value ? 'solid' : 'ghost'"
                square
                :aria-label="`${option.label}预览`"
                @click="viewport = option.value"
              />
            </UTooltip>
          </UButtonGroup>
          <UPopover>
            <UButton
              icon="i-lucide-sliders-horizontal"
              variant="ghost"
              square
              size="sm"
              aria-label="预览条件"
            />
            <template #content>
              <div class="preview-conditions">
                <UFormField label="直播状态">
                  <USelect
                    v-model="simulatedLiveState"
                    :items="[
                      { label: '使用真实状态', value: 'actual' },
                      { label: '模拟直播中', value: 'live' },
                      { label: '模拟未开播', value: 'offline' },
                    ]"
                  />
                </UFormField>
                <UFormField label="预览时间">
                  <UInput
                    v-model="simulatedNowInput"
                    type="datetime-local"
                  />
                </UFormField>
                <UButton
                  v-if="simulatedNow !== null"
                  label="使用当前时间"
                  variant="ghost"
                  size="sm"
                  @click="simulatedNow = null"
                />
              </div>
            </template>
          </UPopover>
          <UTooltip text="在真实页面中预览草稿">
            <UButton
              icon="i-lucide-external-link"
              variant="ghost"
              square
              size="sm"
              aria-label="在真实页面中预览草稿"
              @click="editor.openPreview"
            />
          </UTooltip>
        </div>
      </div>
    </template>
    <div
      ref="previewRoot"
      class="preview-pane-content"
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
              <DefaultIndexTemplate
                :user-info="editor.account.value as any"
                :bili-info="biliProfileQuery.data.value"
              />
            </template>
            <UAlert
              v-else
              color="warning"
              icon="i-lucide-triangle-alert"
              :description="`当前页模式：${editor.getPageModeLabel(editor.currentPage.value.mode)}，非区块页，不展示预览。`"
            />
          </div>
        </Transition>
      </PhonePreview>
    </div>
  </UCard>
</template>

<style scoped>
.preview-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.preview-conditions {
  display: grid;
  gap: 12px;
  width: 260px;
  padding: 12px;
}

.preview-pane-content {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
