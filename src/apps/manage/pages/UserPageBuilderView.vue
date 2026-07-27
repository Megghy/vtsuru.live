<script setup lang="ts">
import { NAlert, NButton, NFlex, NIcon, NModal, NSplit, NSpin, NText, useDialog } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ReorderThreeOutline } from '@vicons/ionicons5'
import { useEventListener } from '@vueuse/core'
import { VueDraggable } from 'vue-draggable-plus'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { UserPageEditorKey } from './user-page-builder/context'
import { useUserPageEditor } from './user-page-builder/useUserPageEditor'
import { COLUMN_META, DEFAULT_COLUMNS_ORDER, useBuilderLayout } from './user-page-builder/useBuilderLayout'
import BuilderPagesPane from './user-page-builder/components/BuilderPagesPane.vue'
import BuilderBlocksPane from './user-page-builder/components/BuilderBlocksPane.vue'
import BuilderPreviewPane from './user-page-builder/components/BuilderPreviewPane.vue'
import BuilderPropsPane from './user-page-builder/components/BuilderPropsPane.vue'
import BuilderToolbar from './user-page-builder/components/BuilderToolbar.vue'
import BuilderResourcesModal from './user-page-builder/components/BuilderResourcesModal.vue'
import GlobalPageStyleModal from './user-page-builder/components/GlobalPageStyleModal.vue'
import BlockPageThemeModal from './user-page-builder/components/BlockPageThemeModal.vue'

const editor = useUserPageEditor()
provide(UserPageEditorKey, editor)
let stopBeforeUnload: (() => void) | null = null
const route = useRoute()
const router = useRouter()
const dialog = useDialog()

const layoutModal = ref(false)
const globalBgModal = ref(false)
const isLegacyMode = computed(() => editor.currentPage.value.mode === 'legacy')
const builderLayout = useBuilderLayout()
const {
  bodyElement: builderBodyEl,
  columnsOrder,
  isPropsMergedInBlocks,
  layoutColumnsModel,
  col0,
  col1,
  col2,
  col3,
  isFourCols,
  size0,
  size1,
  size2,
  split0Min,
  split0Max,
  split0Pane1Style,
  split0Pane2Style,
  split1Min,
  split1Max,
  split1Pane1Style,
  split1Pane2Style,
  split2Min,
  split2Max,
  split2Pane1Style,
  split2Pane2Style,
  isPagesResizable,
  isPagesCollapsed,
  togglePagesCollapse,
  toggleMergePropsInBlocks,
  releaseStuckSplitDrag,
} = builderLayout

function beforeUnloadHandler(e: BeforeUnloadEvent) {
  if (!editor.isDirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

function focusPublishValidationError(errorMessage: string) {
  if (!editor.focusValidationError(errorMessage)) return
  editor.publishModal.value = false
  const request = editor.validationFocusRequest.value
  if (request?.scope === 'settings') globalBgModal.value = true
  else if (
    request?.scope === 'page'
    && editor.currentPage.value.mode === 'block'
    && (request.fieldPath?.startsWith('theme') || request.fieldPath?.startsWith('background'))
  ) editor.pageThemeModal.value = true
}

onMounted(async () => {
  builderLayout.mount()
  await editor.init()
  requestAnimationFrame(() => builderLayout.updateBodyWidth())

  const mode = route.query.mode
  if (mode === 'legacy' || mode === 'block' || mode === 'contrib') {
    editor.currentKey.value = 'home'
    editor.currentPage.value.mode = mode
    await router.replace({ name: 'manage-userPageBuilder' })
  }

  stopBeforeUnload = useEventListener(window, 'beforeunload', beforeUnloadHandler)
})

onBeforeUnmount(() => {
  builderLayout.destroy()
  stopBeforeUnload?.()
  editor.destroy()
})

onBeforeRouteLeave(() => {
  releaseStuckSplitDrag()
  if (!editor.isDirty.value) return true
  return new Promise<boolean>((resolve) => {
    dialog.warning({
      title: '离开编辑器',
      content: '当前有未保存的更改，离开后这些更改将丢失。',
      positiveText: '离开',
      negativeText: '继续编辑',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
    })
  })
})
</script>

<template>
  <div class="user-page-builder">
    <ManagePageHeader title="自定义页面" subtitle="配置个人主页与子页面">
      <template #action>
        <BuilderToolbar
          @open-layout="layoutModal = true"
          @open-global-style="globalBgModal = true"
        />
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

      <div ref="builderBodyEl" class="builder-body">
        <Transition name="workspace-switch" mode="out-in">
          <div v-if="isLegacyMode" key="legacy" class="legacy-workspace">
            <BuilderPreviewPane />
            <BuilderPropsPane />
          </div>
          <NSplit
            v-else
            key="builder"
            v-model:size="size0"
            direction="horizontal"
            :min="split0Min"
            :max="split0Max"
            class="builder-split"
            :pane1-style="split0Pane1Style"
            :pane2-style="split0Pane2Style"
          >
            <template #1>
              <BuilderPagesPane
                v-if="col0 === 'pages'"
                :collapsed="isPagesCollapsed"
                :resizable="isPagesResizable"
                @toggle-collapse="togglePagesCollapse"
              />
              <BuilderBlocksPane
                v-else-if="col0 === 'blocks'"
                :merged-props="isPropsMergedInBlocks"
                @toggle-merged-props="toggleMergePropsInBlocks"
              />
              <BuilderPreviewPane v-else-if="col0 === 'preview'" />
              <BuilderPropsPane v-else />
            </template>

            <template #2>
              <NSplit
                v-model:size="size1"
                direction="horizontal"
                :min="split1Min"
                :max="split1Max"
                class="builder-split"
                :pane1-style="split1Pane1Style"
                :pane2-style="split1Pane2Style"
              >
                <template #1>
                  <BuilderPagesPane
                    v-if="col1 === 'pages'"
                    :collapsed="isPagesCollapsed"
                    :resizable="isPagesResizable"
                    @toggle-collapse="togglePagesCollapse"
                  />
                  <BuilderBlocksPane
                    v-else-if="col1 === 'blocks'"
                    :merged-props="isPropsMergedInBlocks"
                    @toggle-merged-props="toggleMergePropsInBlocks"
                  />
                  <BuilderPreviewPane v-else-if="col1 === 'preview'" />
                  <BuilderPropsPane v-else />
                </template>

                <template #2>
                  <template v-if="!isFourCols">
                    <BuilderPagesPane
                      v-if="col2 === 'pages'"
                      :collapsed="isPagesCollapsed"
                      :resizable="isPagesResizable"
                      @toggle-collapse="togglePagesCollapse"
                    />
                    <BuilderBlocksPane
                      v-else-if="col2 === 'blocks'"
                      :merged-props="isPropsMergedInBlocks"
                      @toggle-merged-props="toggleMergePropsInBlocks"
                    />
                    <BuilderPreviewPane v-else-if="col2 === 'preview'" />
                    <BuilderPropsPane v-else />
                  </template>
                  <NSplit
                    v-else
                    v-model:size="size2"
                    direction="horizontal"
                    :min="split2Min"
                    :max="split2Max"
                    class="builder-split"
                    :pane1-style="split2Pane1Style"
                    :pane2-style="split2Pane2Style"
                  >
                    <template #1>
                      <BuilderPagesPane
                        v-if="col2 === 'pages'"
                        :collapsed="isPagesCollapsed"
                        :resizable="isPagesResizable"
                        @toggle-collapse="togglePagesCollapse"
                      />
                      <BuilderBlocksPane
                        v-else-if="col2 === 'blocks'"
                        :merged-props="isPropsMergedInBlocks"
                        @toggle-merged-props="toggleMergePropsInBlocks"
                      />
                      <BuilderPreviewPane v-else-if="col2 === 'preview'" />
                      <BuilderPropsPane v-else />
                    </template>

                    <template #2>
                      <BuilderPagesPane
                        v-if="col3 === 'pages'"
                        :collapsed="isPagesCollapsed"
                        :resizable="isPagesResizable"
                        @toggle-collapse="togglePagesCollapse"
                      />
                      <BuilderBlocksPane
                        v-else-if="col3 === 'blocks'"
                        :merged-props="isPropsMergedInBlocks"
                        @toggle-merged-props="toggleMergePropsInBlocks"
                      />
                      <BuilderPreviewPane v-else-if="col3 === 'preview'" />
                      <BuilderPropsPane v-else />
                    </template>
                  </NSplit>
                </template>
              </NSplit>
            </template>
          </NSplit>
        </Transition>
      </div>

      <NModal
        v-model:show="layoutModal"
        preset="card"
        title="编辑器布局"
        style="width: 520px; max-width: 95vw"
        :auto-focus="false"
      >
        <NAlert type="info" :show-icon="true" style="margin-bottom: 12px">
          拖拽调整列从左到右顺序。最后一列会自动填充剩余宽度（想让某列更宽/更窄，可以把它放到最后）。
        </NAlert>
        <VueDraggable
          v-model="layoutColumnsModel"
          handle=".drag-handle"
          :animation="160"
        >
          <div
            v-for="id in layoutColumnsModel"
            :key="id"
            style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid var(--n-border-color); border-radius: 10px; margin: 8px 0"
          >
            <div style="min-width: 0; display: flex; align-items: center; gap: 10px">
              <NIcon class="drag-handle" size="18" style="cursor: grab">
                <ReorderThreeOutline />
              </NIcon>
              <NText strong>
                {{ COLUMN_META[id as any]?.label ?? id }}
              </NText>
            </div>
            <NText depth="3" style="font-size: 12px; white-space: nowrap">
              {{ id }}
            </NText>
          </div>
        </VueDraggable>
        <template #footer>
          <NFlex justify="space-between">
            <NButton
              size="small"
              secondary
              @click="columnsOrder = [...DEFAULT_COLUMNS_ORDER]"
            >
              重置默认
            </NButton>
            <NButton size="small" type="primary" @click="layoutModal = false">
              完成
            </NButton>
          </NFlex>
        </template>
      </NModal>

      <BuilderResourcesModal v-model:show="editor.resourcesModal.value" />

      <GlobalPageStyleModal v-model:show="globalBgModal" />

      <BlockPageThemeModal v-model:show="editor.pageThemeModal.value" />

      <NModal
        v-model:show="editor.publishModal.value"
        preset="card"
        title="发布前检查"
        style="width: 720px; max-width: 95vw"
        :auto-focus="false"
      >
        <NFlex vertical>
          <NText depth="3">
            配置大小：{{ editor.publishCheckBytes.value }} bytes（后端上限 131072 bytes / 128KB）
          </NText>

          <NAlert v-if="editor.publishCheckErrors.value.length" type="error" :show-icon="true">
            <NButton
              v-for="(it, idx) in editor.publishCheckErrors.value"
              :key="idx"
              text
              type="error"
              class="validation-error-link"
              @click="focusPublishValidationError(it)"
            >
              {{ it }}
            </NButton>
          </NAlert>
          <NAlert v-else type="success" :show-icon="true">
            校验通过，可以发布
          </NAlert>

          <NAlert v-if="editor.publishCheckWarnings.value.length" type="warning" :show-icon="true">
            <div v-for="(it, idx) in editor.publishCheckWarnings.value" :key="idx">
              {{ it }}
            </div>
          </NAlert>
        </NFlex>
        <template #footer>
          <NFlex justify="end">
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
          </NFlex>
        </template>
      </NModal>
    </NSpin>
  </div>
</template>

<style src="./user-page-builder/components/ui-transitions.css"></style>

<style scoped>
.validation-error-link {
  display: flex;
  width: 100%;
  height: auto;
  justify-content: flex-start;
  margin: 2px 0;
  text-align: left;
  white-space: normal;
}

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

.user-page-builder :deep(.n-split-pane-1:has(> .pages-pane)) {
  transition: flex-basis 200ms cubic-bezier(0.2, 0, 0, 1);
}

.user-page-builder :deep(.n-split:has(> .n-split__resize-trigger-wrapper:active) > .n-split-pane-1) {
  transition: none;
}

.legacy-workspace {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(320px, 420px);
  flex: 1;
  min-height: 0;
  gap: 6px;
}

.workspace-switch-enter-active,
.workspace-switch-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.workspace-switch-enter-from,
.workspace-switch-leave-to {
  opacity: 0;
  transform: translateY(5px);
}

.user-page-builder :deep(.pane-card) {
  height: 100%;
  min-height: 0;
  animation: builder-pane-enter 220ms ease both;
}

.user-page-builder :deep(.pane-scroll) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.user-page-builder :deep(.preview-bg-host) {
  position: absolute;
  inset: 0;
}
.user-page-builder :deep(.preview-bg-host.enabled) {
  overflow: hidden;
}
.user-page-builder :deep(.preview-bg-host.enabled)::before {
  content: "";
  position: absolute;
  inset: calc(-24px - var(--user-page-bg-blur, 0px));
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-size: var(--user-page-bg-size, cover);
  background-position: center;
  transform: none;
  pointer-events: none;
  z-index: 0;
  transition: background-color 180ms ease, filter 180ms ease;
}
.user-page-builder :deep(.preview-bg-host.enabled)::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--user-page-bg-scrim, transparent);
  pointer-events: none;
  z-index: 0;
  transition: background-color 180ms ease, opacity 180ms ease;
}
.user-page-builder :deep(.preview-bg-host.enabled.bg-blur)::before {
  filter: blur(var(--user-page-bg-blur, 0px));
}
.user-page-builder :deep(.preview-bg-host.enabled > *) {
  position: relative;
  z-index: 1;
}
.user-page-builder :deep(.preview-glass-surface) {
  min-height: 100%;
  padding: 12px 0;
  background: var(--glass-surface-bg, rgba(255, 255, 255, 0.55));
  backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  transition: background-color 180ms ease, backdrop-filter 180ms ease;
}

.user-page-builder :deep(.preview-content) {
  min-height: 100%;
}

@keyframes builder-pane-enter {
  from {
    opacity: 0;
    transform: translateY(5px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
