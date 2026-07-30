<script setup lang="ts">
import { CopyOutline, RefreshOutline, TrashOutline } from '@vicons/ionicons5'
import {
  NAlert,
  NButton,
  NEmpty,
  NFlex,
  NIcon,
  NModal,
  NScrollbar,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTooltip,
  useDialog,
} from 'naive-ui'
import { computed, inject, reactive, watch } from 'vue'

import { UploadStage } from '@/shared/services/fileUpload'

import { UserPageEditorKey } from '../context'
import type { BuilderResource } from '../useBuilderResources'
import { useBuilderResources } from '../useBuilderResources'

const show = defineModel<boolean>('show', { required: true })
const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const dialog = useDialog()
const imageDimensions = reactive<Record<number, string>>({})
const resources = useBuilderResources({
  fileRefs: editor.fileRefs,
  notifyError: editor.message.error,
  notifySuccess: editor.message.success,
})

const uploadAlertType = computed(() => {
  if (editor.uploadQueue.value.some((item) => item.stage === UploadStage.Failed)) return 'error'
  if (editor.isUploading.value) return 'info'
  return 'success'
})

watch(
  show,
  (visible) => {
    if (visible) void resources.loadResources()
  },
  { immediate: true },
)

function isImagePath(path?: string) {
  const normalized = path?.toLowerCase().split(/[?#]/, 1)[0] ?? ''
  return /\.(?:png|jpe?g|gif|webp|svg)$/.test(normalized)
}

function formatBytes(bytes?: number) {
  if (bytes === undefined) return '大小未知'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}

function uploadStageType(stage: UploadStage) {
  if (stage === UploadStage.Failed) return 'error'
  if (stage === UploadStage.Success) return 'success'
  return 'info'
}

async function copyResourcePath(path: string) {
  try {
    await navigator.clipboard.writeText(path)
    editor.message.success('资源链接已复制')
  } catch {
    editor.message.error('复制失败，请检查浏览器剪贴板权限')
  }
}

function readImageDimensions(fileId: number, event: Event) {
  const image = event.currentTarget as HTMLImageElement
  imageDimensions[fileId] = `${image.naturalWidth} x ${image.naturalHeight} px`
}

function confirmDelete(resource: BuilderResource) {
  const referenceSummary = resource.locations.length
    ? `该资源正在被 ${resource.locations.length} 处配置引用。删除后这些位置的图片或媒体会失效：${resource.locations.slice(0, 4).join('；')}${resource.locations.length > 4 ? '；以及其他位置' : ''}`
    : '该资源没有被当前用户页面引用。'
  dialog.warning({
    title: '删除资源',
    content: `${referenceSummary}\n\n此操作会删除服务器文件，无法撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => resources.deleteResource(resource),
  })
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    title="资源管理"
    style="width: 900px; max-width: 95vw"
    :auto-focus="false"
  >
    <NFlex
      vertical
      size="large"
    >
      <NAlert
        v-if="editor.uploadQueue.value.length"
        :type="uploadAlertType"
        :show-icon="true"
      >
        <NFlex
          vertical
          size="small"
        >
          <NFlex
            v-for="item in editor.uploadQueue.value"
            :key="item.name"
            align="center"
            justify="space-between"
          >
            <NText>{{ item.name }}</NText>
            <NTag
              :type="uploadStageType(item.stage)"
              size="small"
            >
              {{ item.stage }}
            </NTag>
          </NFlex>
        </NFlex>
      </NAlert>

      <NFlex
        justify="space-between"
        align="center"
      >
        <NText depth="3">
          服务器资源 {{ resources.resources.value.length - resources.missingCount.value }} 个，引用中
          {{ resources.usedCount.value }} 个<template v-if="resources.missingCount.value">
            ，失效引用 {{ resources.missingCount.value }} 个
          </template>
        </NText>
        <NFlex
          :wrap="false"
          size="small"
        >
          <NButton
            size="small"
            secondary
            @click="editor.normalizeRichTextImagesFile"
          >
            整理富文本引用
          </NButton>
          <NTooltip>
            <template #trigger>
              <NButton
                size="small"
                circle
                secondary
                :loading="resources.isLoading.value"
                aria-label="刷新资源"
                @click="resources.loadResources"
              >
                <template #icon>
                  <NIcon><RefreshOutline /></NIcon>
                </template>
              </NButton>
            </template>
            刷新资源
          </NTooltip>
        </NFlex>
      </NFlex>

      <NTabs
        v-model:value="resources.currentView.value"
        type="segment"
        size="small"
        animated
      >
        <NTabPane
          name="all"
          :tab="`全部 ${resources.resources.value.length}`"
        />
        <NTabPane
          name="used"
          :tab="`引用中 ${resources.usedCount.value}`"
        />
        <NTabPane
          name="unused"
          :tab="`未使用 ${resources.unusedCount.value}`"
        />
      </NTabs>

      <NAlert
        v-if="resources.loadError.value"
        type="error"
        :show-icon="true"
      >
        {{ resources.loadError.value }}
      </NAlert>

      <NSpin :show="resources.isLoading.value">
        <NScrollbar style="max-height: 62vh">
          <NFlex
            v-if="resources.visibleResources.value.length"
            vertical
            size="small"
          >
            <div
              v-for="file in resources.visibleResources.value"
              :key="file.id"
              class="resource-row"
            >
              <NFlex
                align="center"
                justify="space-between"
                :wrap="false"
                style="gap: 12px"
              >
                <NFlex
                  align="center"
                  :wrap="false"
                  style="gap: 10px; min-width: 0"
                >
                  <img
                    v-if="isImagePath(file.path) && !file.missing"
                    :src="file.path"
                    :alt="file.name || `资源 ${file.id}`"
                    referrerpolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    class="resource-thumbnail"
                    @load="readImageDimensions(file.id, $event)"
                  />
                  <div
                    v-else
                    class="resource-thumbnail resource-placeholder"
                  >
                    #{{ file.id }}
                  </div>
                  <div class="resource-main">
                    <NFlex
                      align="center"
                      size="small"
                    >
                      <NText strong>
                        {{ file.name || `资源 #${file.id}` }}
                      </NText>
                      <NTag
                        v-if="file.missing"
                        type="error"
                        size="small"
                      >
                        文件已失效
                      </NTag>
                      <NTag
                        v-else
                        :type="file.locations.length ? 'success' : 'default'"
                        size="small"
                      >
                        {{ file.locations.length ? `引用 ${file.locations.length} 处` : '未使用' }}
                      </NTag>
                    </NFlex>
                    <NText
                      depth="3"
                      class="resource-meta"
                    >
                      #{{ file.id }} · {{ formatBytes(file.size)
                      }}<template v-if="imageDimensions[file.id]"> · {{ imageDimensions[file.id] }} </template>
                    </NText>
                    <NText
                      depth="3"
                      class="resource-path"
                    >
                      {{ file.path || '无公开地址' }}
                    </NText>
                  </div>
                </NFlex>

                <NFlex
                  v-if="!file.missing"
                  :wrap="false"
                  size="small"
                >
                  <NTooltip v-if="file.path">
                    <template #trigger>
                      <NButton
                        circle
                        secondary
                        size="small"
                        aria-label="复制资源链接"
                        @click="copyResourcePath(file.path)"
                      >
                        <template #icon>
                          <NIcon><CopyOutline /></NIcon>
                        </template>
                      </NButton>
                    </template>
                    复制资源链接
                  </NTooltip>
                  <NTooltip>
                    <template #trigger>
                      <NButton
                        circle
                        secondary
                        type="error"
                        size="small"
                        aria-label="删除资源"
                        :loading="resources.deletingId.value === file.id"
                        @click="confirmDelete(file)"
                      >
                        <template #icon>
                          <NIcon><TrashOutline /></NIcon>
                        </template>
                      </NButton>
                    </template>
                    删除资源
                  </NTooltip>
                </NFlex>
              </NFlex>

              <NText
                v-if="file.locations.length"
                depth="3"
                class="resource-locations"
              >
                {{ file.locations.join('；') }}
              </NText>
            </div>
          </NFlex>
          <NEmpty
            v-else-if="!resources.isLoading.value"
            description="当前分类没有资源"
          />
        </NScrollbar>
      </NSpin>
    </NFlex>
  </NModal>
</template>

<style scoped>
.resource-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--vtsuru-border);
}

.resource-thumbnail {
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  object-fit: cover;
}

.resource-placeholder {
  display: grid;
  place-items: center;
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
  background: var(--vtsuru-bg-muted);
}

.resource-main {
  min-width: 0;
}

.resource-path,
.resource-locations {
  display: block;
  overflow-wrap: anywhere;
}

.resource-path {
  margin-top: 2px;
}

.resource-meta {
  display: block;
  margin-top: 2px;
  font-size: 12px;
}

.resource-locations {
  margin-top: 8px;
  padding-left: 58px;
  font-size: 12px;
}

@media (max-width: 640px) {
  .resource-locations {
    padding-left: 0;
  }
}
</style>
