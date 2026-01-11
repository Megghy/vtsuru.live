<script setup lang="ts">
import { NAlert, NButton, NCard, NFlex, NIcon, NModal, NPopconfirm, NScrollbar, NSpace, NSplit, NSpin, NSwitch, NText } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, provide, watchEffect } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ArrowRedoOutline, ArrowUndoOutline, ChevronBackOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { useEventListener, useStorage } from '@vueuse/core'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import BlockPageRenderer from '@/features/user-page/block/BlockPageRenderer.vue'
import DefaultIndexTemplate from '@/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue'
import { UserPageEditorKey } from './user-page-builder/context'
import { USER_PAGE_BUILDER_SPLIT_CENTER_SIZE_KEY, USER_PAGE_BUILDER_SPLIT_LEFT_SIZE_KEY } from './user-page-builder/storageKeys'
import { useUserPageEditor } from './user-page-builder/useUserPageEditor'
import PageManager from './user-page-builder/components/PageManager.vue'
import BlockPropertyEditor from './user-page-builder/components/BlockPropertyEditor.vue'
import PhonePreview from './user-page-builder/components/PhonePreview.vue'
import { hexToRgba, isDarkMode } from '@/shared/utils'

const editor = useUserPageEditor()
provide(UserPageEditorKey, editor)
let stopBeforeUnload: (() => void) | null = null
const route = useRoute()
const router = useRouter()
const leftSize = useStorage<string | number>(USER_PAGE_BUILDER_SPLIT_LEFT_SIZE_KEY, '220px')
const centerSize = useStorage<string | number>(USER_PAGE_BUILDER_SPLIT_CENTER_SIZE_KEY, '640px')

const isSidebarCollapsed = computed(() => leftSize.value === '52px')
let lastExpandedSidebarSize = '220px'
watchEffect(() => {
  if (!isSidebarCollapsed.value && typeof leftSize.value === 'string' && leftSize.value !== '52px') lastExpandedSidebarSize = leftSize.value
})

function isImagePath(path?: string) {
  if (!path) return false
  const p = path.toLowerCase().split('?')[0]?.split('#')[0] ?? ''
  return /\.(?:png|jpe?g|gif|webp|svg)$/.test(p)
}

function getUploadedFilePath(v: unknown): string {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ''
  const path = (v as any).path
  return typeof path === 'string' ? path : ''
}

const previewBg = computed(() => {
  const p = editor.currentProject.value
  if (!p) return { enabled: false, type: 'none' as const, coverSidebar: true, blurMode: 'none' as const, blurPx: 0, color: 'transparent', imagePath: '' }
  const theme: any = p.theme ?? {}
  const type = (theme.pageBackgroundType === 'color' || theme.pageBackgroundType === 'image') ? theme.pageBackgroundType : 'none'
  const coverSidebar = theme.pageBackgroundCoverSidebar !== false
  const blurMode = (theme.pageBackgroundBlurMode === 'background' || theme.pageBackgroundBlurMode === 'glass') ? theme.pageBackgroundBlurMode : 'none'
  const fit = (theme.pageBackgroundImageFit === 'contain' || theme.pageBackgroundImageFit === 'fill' || theme.pageBackgroundImageFit === 'none')
    ? theme.pageBackgroundImageFit
    : 'cover'
  const blur = Number(theme.pageBackgroundBlur)
  const blurPx = Number.isFinite(blur) ? Math.min(40, Math.max(0, Math.round(blur))) : 14
  const color = typeof theme.pageBackgroundColor === 'string' ? theme.pageBackgroundColor : 'transparent'
  const imagePath = getUploadedFilePath(theme.pageBackgroundImageFile)
  const enabled = type !== 'none' && (type !== 'image' || !!imagePath)
  return { enabled, type, coverSidebar, blurMode, blurPx, color, imagePath, fit }
})

const previewBgVars = computed(() => {
  const bg = previewBg.value
  if (!bg.enabled) return {}
  const img = bg.type === 'image' ? bg.imagePath.trim() : ''
  const safeUrl = img ? img.replaceAll('"', '\\"') : ''
  const mode = (editor.currentProject.value?.theme as any)?.pageThemeMode
  const effectiveIsDark = mode === 'dark' ? true : (mode === 'light' ? false : isDarkMode.value)
  const scrimAlpha = bg.blurMode === 'glass' ? 0.12 : (bg.blurMode === 'background' ? 0.26 : 0.34)
  const scrim = effectiveIsDark ? `rgba(0, 0, 0, ${scrimAlpha})` : `rgba(255, 255, 255, ${scrimAlpha})`
  const glassColor = bg.type === 'color' && bg.color
    ? hexToRgba(bg.color, 0.55)
    : (bg.type === 'image' ? 'transparent' : null)
  return {
    '--user-page-bg-color': bg.type === 'color' ? bg.color : 'transparent',
    '--user-page-bg-image': safeUrl ? `url("${safeUrl}")` : 'none',
    '--user-page-bg-size': bg.fit === 'fill' ? '100% 100%' : (bg.fit === 'none' ? 'auto' : bg.fit),
    '--user-page-bg-blur': `${bg.blurPx}px`,
    '--user-page-bg-scrim': scrim,
    '--glass-surface-bg': glassColor || 'rgba(255, 255, 255, 0.55)',
  } as Record<string, string>
})

const previewBgClass = computed(() => ({
  'preview-bg-host': true,
  enabled: previewBg.value.enabled,
  glass: previewBg.value.blurMode === 'glass',
  'bg-blur': previewBg.value.blurMode === 'background',
}))

function beforeUnloadHandler(e: BeforeUnloadEvent) {
  if (!editor.isDirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

onMounted(async () => {
  await editor.init()

  const mode = route.query.mode
  if (mode === 'legacy' || mode === 'block' || mode === 'contrib') {
    editor.currentKey.value = 'home'
    editor.currentPage.value.mode = mode
    await router.replace({ name: 'manage-userPageBuilder' })
  }

  stopBeforeUnload = useEventListener(window, 'beforeunload', beforeUnloadHandler)
})

onBeforeUnmount(() => {
  stopBeforeUnload?.()
  editor.destroy()
})

onBeforeRouteLeave(() => {
  if (!editor.isDirty.value) return true
  // eslint-disable-next-line no-alert
  return window.confirm('当前有未保存的更改，确定离开吗？')
})
</script>

<template>
  <div class="user-page-builder">
    <ManagePageHeader title="自定义页面" subtitle="配置个人主页与子页面">
      <template #action>
        <NFlex justify="end" align="center" :wrap="false">
          <NButton
            quaternary
            circle
            size="small"
            :disabled="!editor.canUndo.value"
            @click="editor.undo"
          >
            <template #icon>
              <NIcon><ArrowUndoOutline /></NIcon>
            </template>
          </NButton>
          <NButton
            quaternary
            circle
            size="small"
            :disabled="!editor.canRedo.value"
            @click="editor.redo"
          >
            <template #icon>
              <NIcon><ArrowRedoOutline /></NIcon>
            </template>
          </NButton>

          <NButton size="small" :loading="editor.isSaving.value" @click="editor.saveDraft">
            保存草稿
          </NButton>
          <NButton type="primary" size="small" :loading="editor.isSaving.value" @click="editor.openPublishModal">
            发布
          </NButton>
          <NPopconfirm :disabled="!editor.rollbackAvailable.value" @positive-click="editor.rollback">
            <template #trigger>
              <NButton size="small" :disabled="!editor.rollbackAvailable.value" :loading="editor.isSaving.value">
                回滚
              </NButton>
            </template>
            确定要回滚到上一个已发布版本吗？
          </NPopconfirm>
          <NButton size="small" secondary :disabled="!editor.loadedPublished.value" @click="editor.diffModal.value = true">
            差异
          </NButton>
          <NButton size="small" secondary @click="editor.resourcesModal.value = true">
            资源
          </NButton>
          <NPopconfirm :disabled="editor.isSaving.value" @positive-click="editor.clearDraft">
            <template #trigger>
              <NButton size="small" secondary :disabled="editor.isSaving.value" :loading="editor.isSaving.value">
                清空草稿
              </NButton>
            </template>
            确定要清空草稿吗？此操作会丢弃当前未保存更改，并切换为已发布版本（如存在）。
          </NPopconfirm>
          <NText depth="3">
            {{ editor.saveStatusText.value }}
          </NText>
          <NSpace align="center" size="small">
            <NText depth="3">
              自动保存
            </NText>
            <NSwitch v-model:value="editor.autoSaveEnabled.value" size="small" />
          </NSpace>
        </NFlex>
      </template>
    </ManagePageHeader>

    <NSpin class="builder-spin" :show="editor.isLoading.value">
      <NAlert
        v-if="editor.error.value"
        type="error"
        :show-icon="true"
        style="margin-bottom: 12px"
      >
        {{ editor.error.value }}
      </NAlert>

      <div class="builder-body">
        <NSplit
          v-model:size="leftSize"
          direction="horizontal"
          min="52px"
          max="360px"
          class="builder-split"
          :pane1-style="{ minWidth: '52px', display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }"
          :pane2-style="{ minWidth: '740px', display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }"
        >
          <template #1>
            <NCard
              class="pane-card"
              content-style="padding: 0; height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden"
            >
              <template #header>
                <NFlex justify="space-between" align="center" :wrap="false" style="gap: 6px">
                  <NText v-if="!isSidebarCollapsed" strong>
                    页面
                  </NText>
                  <NButton
                    quaternary
                    circle
                    size="small"
                    @click="leftSize = isSidebarCollapsed ? lastExpandedSidebarSize : '52px'"
                  >
                    <template #icon>
                      <NIcon>
                        <ChevronBackOutline v-if="!isSidebarCollapsed" />
                        <ChevronForwardOutline v-else />
                      </NIcon>
                    </template>
                  </NButton>
                </NFlex>
              </template>
              <NScrollbar v-if="!isSidebarCollapsed" class="pane-scroll">
                <div style="padding: 12px">
                  <PageManager />
                </div>
              </NScrollbar>
            </NCard>
          </template>

          <template #2>
            <NSplit
              v-model:size="centerSize"
              direction="horizontal"
              min="420px"
              max="1200px"
              class="builder-split"
              :pane1-style="{ minWidth: '420px', display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }"
              :pane2-style="{ minWidth: '320px', display: 'flex', flexDirection: 'column', minHeight: '0', overflow: 'hidden' }"
            >
              <template #1>
                <NCard
                  class="pane-card"
                  :title="`预览 - ${editor.currentLabel.value}`"
                  content-style="display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden"
                >
                  <NAlert type="info" :show-icon="true" style="margin-bottom: 12px">
                    当前编辑来源：{{ editor.loadedFromLabel.value }}。对外展示使用已发布版本。
                  </NAlert>

                  <NScrollbar class="pane-scroll">
                    <div style="height: 100%; min-height: 0; display: flex; flex-direction: column">
                      <PhonePreview style="flex: 1; min-height: 0" :transparent="previewBg.enabled">
                        <div :class="previewBgClass" :style="previewBgVars">
                          <template v-if="editor.currentPage.value.mode === 'block' && editor.currentProject.value">
                            <div v-if="previewBg.enabled && previewBg.blurMode === 'glass'" class="preview-glass-surface">
                              <BlockPageRenderer
                                :project="editor.currentProject.value"
                                :user-info="editor.account.value"
                                :bili-info="undefined"
                              />
                            </div>
                            <BlockPageRenderer
                              v-else
                              :project="editor.currentProject.value"
                              :user-info="editor.account.value"
                              :bili-info="undefined"
                            />
                          </template>
                          <template v-else-if="editor.currentPage.value.mode === 'legacy'">
                            <DefaultIndexTemplate :user-info="editor.account.value as any" :bili-info="undefined" />
                          </template>
                          <NAlert
                            v-else
                            type="warning"
                            :show-icon="true"
                          >
                            当前页模式：{{ editor.getPageModeLabel(editor.currentPage.value.mode) }}（非区块页），此处不展示预览。
                          </NAlert>
                        </div>
                      </PhonePreview>
                    </div>
                  </NScrollbar>
                </NCard>
              </template>

              <template #2>
                <NScrollbar class="pane-scroll">
                  <BlockPropertyEditor />
                </NScrollbar>
              </template>
            </NSplit>
          </template>
        </NSplit>
      </div>

      <NModal
        v-model:show="editor.diffModal.value"
        preset="card"
        title="草稿（当前）与已发布差异"
        style="width: 980px; max-width: 95vw"
        :auto-focus="false"
      >
        <NAlert v-if="!editor.loadedPublished.value" type="warning" :show-icon="true">
          当前没有已发布版本
        </NAlert>
        <NScrollbar v-else style="max-height: 70vh">
          <pre style="margin: 0; font-size: 12px; line-height: 1.6">
<template v-for="(op, idx) in editor.diffOps.value || []" :key="idx">
<span v-if="op.kind === 'add'" style="background: rgba(46, 160, 67, 0.15)">{{ `+ ${op.text}\n` }}</span>
<span v-else-if="op.kind === 'del'" style="background: rgba(248, 81, 73, 0.15)">{{ `- ${op.text}\n` }}</span>
<span v-else>{{ `  ${op.text}\n` }}</span>
</template>
        </pre>
        </NScrollbar>
      </NModal>

      <NModal
        v-model:show="editor.resourcesModal.value"
        preset="card"
        title="已引用资源（从 *File 字段提取）"
        style="width: 900px; max-width: 95vw"
        :auto-focus="false"
      >
        <NSpace vertical>
          <NSpace justify="space-between" align="center">
            <NText depth="3">
              共 {{ editor.fileRefs.value.length }} 个文件引用
            </NText>
            <NButton size="small" secondary @click="editor.normalizeRichTextImagesFile">
              整理 richText 引用
            </NButton>
          </NSpace>
          <NScrollbar style="max-height: 70vh">
            <div
              v-for="f in editor.fileRefs.value"
              :key="f.id"
              style="padding: 8px 0; border-bottom: 1px solid var(--n-divider-color)"
            >
              <NFlex align="center" :wrap="false" style="gap: 10px">
                <img
                  v-if="isImagePath(f.path)"
                  :src="f.path"
                  alt=""
                  referrerpolicy="no-referrer"
                  loading="lazy"
                  decoding="async"
                  style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px; border: 1px solid var(--n-border-color); flex: 0 0 auto"
                >
                <div style="min-width: 0">
                  <NText strong>
                    #{{ f.id }}
                  </NText>
                  <NText depth="3" style="margin-left: 8px">
                    {{ f.path || '' }}
                  </NText>
                  <NText v-if="f.name" depth="3" style="margin-left: 8px">
                    ({{ f.name }})
                  </NText>
                </div>
              </NFlex>
              <div style="margin-top: 6px">
                <NText depth="3">
                  {{ f.locations.join('；') }}
                </NText>
              </div>
            </div>
          </NScrollbar>
        </NSpace>
      </NModal>

      <NModal
        v-model:show="editor.publishModal.value"
        preset="card"
        title="发布前检查"
        style="width: 720px; max-width: 95vw"
        :auto-focus="false"
      >
        <NSpace vertical>
          <NText depth="3">
            配置大小：{{ editor.publishCheckBytes.value }} bytes（后端上限 131072 bytes / 128KB）
          </NText>

          <NAlert v-if="editor.publishCheckErrors.value.length" type="error" :show-icon="true">
            <div v-for="(it, idx) in editor.publishCheckErrors.value" :key="idx">
              {{ it }}
            </div>
          </NAlert>
          <NAlert v-else type="success" :show-icon="true">
            校验通过，可以发布
          </NAlert>

          <NAlert v-if="editor.publishCheckWarnings.value.length" type="warning" :show-icon="true">
            <div v-for="(it, idx) in editor.publishCheckWarnings.value" :key="idx">
              {{ it }}
            </div>
          </NAlert>
        </NSpace>
        <template #footer>
          <NSpace justify="end">
            <NButton @click="editor.publishModal.value = false">
              取消
            </NButton>
            <NButton
              type="primary"
              :disabled="editor.publishCheckErrors.value.length > 0"
              :loading="editor.isSaving.value"
              @click="editor.publishModal.value = false; editor.confirmPublish()"
            >
              确认发布
            </NButton>
          </NSpace>
        </template>
      </NModal>
    </NSpin>
  </div>
</template>

<style scoped>
.user-page-builder :deep(.n-button .n-button__content) {
  gap: 6px;
}

.user-page-builder {
  height: calc(100vh - var(--vtsuru-header-height));
  width: 100%;
  padding: var(--vtsuru-content-padding);
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.builder-spin {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.builder-spin :deep(.n-spin-content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.builder-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.builder-split {
  flex: 1;
  min-height: 0;
}

.pane-card {
  height: 100%;
  min-height: 0;
}

.pane-scroll {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.preview-bg-host {
  min-height: 100%;
}
.preview-bg-host.enabled {
  position: relative;
  overflow: hidden;
}
.preview-bg-host.enabled::before {
  content: "";
  position: absolute;
  inset: -24px;
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-size: var(--user-page-bg-size, cover);
  background-position: center;
  transform: none;
  pointer-events: none;
  z-index: 0;
}
.preview-bg-host.enabled::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--user-page-bg-scrim, transparent);
  pointer-events: none;
  z-index: 0;
}
.preview-bg-host.enabled.bg-blur::before {
  filter: blur(var(--user-page-bg-blur, 0px));
}
.preview-bg-host.enabled > * {
  position: relative;
  z-index: 1;
}
.preview-glass-surface {
  min-height: 100%;
  padding: 12px 0;
  background: var(--glass-surface-bg, rgba(255, 255, 255, 0.55));
  backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 0px));
}
</style>
