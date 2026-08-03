<script setup lang="ts">
import { computed, inject, reactive, watch } from 'vue'

import { UploadStage } from '@/shared/services/fileUpload'

import { UserPageEditorKey } from '../context'
import type { BuilderResource } from '../useBuilderResources'
import { useBuilderResources } from '../useBuilderResources'

const show = defineModel<boolean>('show', { required: true })
const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

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
  if (window.confirm(`${referenceSummary}\n\n此操作会删除服务器文件，无法撤销。`))
    void resources.deleteResource(resource)
}
</script>

<template>
  <UModal
    v-model:open="show"
    title="资源管理"
    style="width: 900px; max-width: 95vw"
  >
    <template #body
      ><div class="builder-stack">
        <UAlert
          v-if="editor.uploadQueue.value.length"
          :type="uploadAlertType"
          :show-icon="true"
        >
          <div class="builder-stack">
            <div
              class="builder-row"
              v-for="item in editor.uploadQueue.value"
              :key="item.name"
            >
              <span class="builder-text">{{ item.name }}</span>
              <UBadge
                :type="uploadStageType(item.stage)"
                size="sm"
              >
                {{ item.stage }}
              </UBadge>
            </div>
          </div>
        </UAlert>

        <div class="builder-row">
          <span class="builder-text">
            服务器资源 {{ resources.resources.value.length - resources.missingCount.value }} 个，引用中
            {{ resources.usedCount.value }} 个<template v-if="resources.missingCount.value">
              ，失效引用 {{ resources.missingCount.value }} 个
            </template>
          </span>
          <div class="builder-row">
            <UButton
              size="sm"
              variant="soft"
              @click="editor.normalizeRichTextImagesFile"
            >
              整理富文本引用
            </UButton>
            <UTooltip>
              <UButton
                size="sm"
                square
                variant="soft"
                :loading="resources.isLoading.value"
                aria-label="刷新资源"
                @click="resources.loadResources"
              >
                <template #icon>
                  <UIcon name="i-lucide-refresh-cw" />
                </template>
              </UButton>
              <template #content> 刷新资源 </template></UTooltip
            >
          </div>
        </div>

        <UTabs
          v-model="resources.currentView.value"
          :items="[
            { label: `全部 ${resources.resources.value.length}`, value: 'all' },
            { label: `引用中 ${resources.usedCount.value}`, value: 'used' },
            { label: `未使用 ${resources.unusedCount.value}`, value: 'unused' },
          ]"
          size="sm"
        />

        <UAlert
          v-if="resources.loadError.value"
          type="error"
          :show-icon="true"
        >
          {{ resources.loadError.value }}
        </UAlert>

        <div class="resource-loading-host">
          <UIcon
            v-if="resources.isLoading.value"
            name="i-lucide-loader-circle"
            class="resource-loading-icon"
          />
          <div
            class="builder-scroll"
            style="max-height: 62vh"
          >
            <div
              class="builder-stack"
              v-if="resources.visibleResources.value.length"
            >
              <div
                v-for="file in resources.visibleResources.value"
                :key="file.id"
                class="resource-row"
              >
                <div
                  class="builder-row"
                  style="gap: 12px"
                >
                  <div
                    class="builder-row"
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
                      <div class="builder-row">
                        <span class="builder-text">
                          {{ file.name || `资源 #${file.id}` }}
                        </span>
                        <UBadge
                          v-if="file.missing"
                          type="error"
                          size="sm"
                        >
                          文件已失效
                        </UBadge>
                        <UBadge
                          v-else
                          :type="file.locations.length ? 'success' : 'default'"
                          size="sm"
                        >
                          {{ file.locations.length ? `引用 ${file.locations.length} 处` : '未使用' }}
                        </UBadge>
                      </div>
                      <span class="builder-text resource-meta">
                        #{{ file.id }} · {{ formatBytes(file.size)
                        }}<template v-if="imageDimensions[file.id]"> · {{ imageDimensions[file.id] }} </template>
                      </span>
                      <span class="builder-text resource-path">
                        {{ file.path || '无公开地址' }}
                      </span>
                    </div>
                  </div>

                  <div
                    class="builder-row"
                    v-if="!file.missing"
                  >
                    <UTooltip v-if="file.path">
                      <UButton
                        square
                        variant="soft"
                        size="sm"
                        aria-label="复制资源链接"
                        @click="copyResourcePath(file.path)"
                      >
                        <template #icon>
                          <UIcon name="i-lucide-copy" />
                        </template>
                      </UButton>
                      <template #content> 复制资源链接 </template></UTooltip
                    >
                    <UTooltip>
                      <UButton
                        square
                        variant="soft"
                        color="error"
                        size="sm"
                        aria-label="删除资源"
                        :loading="resources.deletingId.value === file.id"
                        @click="confirmDelete(file)"
                      >
                        <template #icon>
                          <UIcon name="i-lucide-trash-2" />
                        </template>
                      </UButton>
                      <template #content> 删除资源 </template></UTooltip
                    >
                  </div>
                </div>

                <span
                  v-if="file.locations.length"
                  class="builder-text resource-locations"
                >
                  {{ file.locations.join('；') }}
                </span>
              </div>
            </div>
            <UEmpty
              v-else-if="!resources.isLoading.value"
              description="当前分类没有资源"
            />
          </div>
        </div></div
    ></template>
  </UModal>
</template>

<style scoped>
.resource-loading-host {
  position: relative;
  min-height: 80px;
}

.resource-loading-icon {
  position: absolute;
  z-index: 2;
  top: 24px;
  left: 50%;
  width: 24px;
  height: 24px;
  animation: resource-spin 0.8s linear infinite;
}

@keyframes resource-spin {
  to {
    transform: rotate(360deg);
  }
}
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
