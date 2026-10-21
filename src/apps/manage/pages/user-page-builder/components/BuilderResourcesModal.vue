<script setup lang="ts">
import { CopyOutline, RefreshOutline, TrashOutline } from '@vicons/ionicons5'
import { computed, inject, reactive, watch } from 'vue'

import { UploadStage } from '@/shared/services/fileUpload'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tag } from '@/shared/ui/tag'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useDialog } from '@/shared/utils'

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
  if (editor.uploadQueue.value.some((item) => item.stage === UploadStage.Failed)) return 'destructive'
  return 'default'
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

function uploadStageVariant(stage: UploadStage): 'destructive' | 'default' | 'secondary' {
  if (stage === UploadStage.Failed) return 'destructive'
  if (stage === UploadStage.Success) return 'default'
  return 'secondary'
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
  <Dialog :open="show" @update:open="(val) => (show = val)">
    <DialogContent class="max-w-[900px] w-[95vw] p-6 max-h-[88vh] flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold"> 资源管理 </DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-4 min-h-0 flex-1 overflow-hidden">
        <Alert v-if="editor.uploadQueue.value.length" :variant="uploadAlertType">
          <AlertDescription>
            <div class="flex flex-col gap-1 text-xs">
              <div
                v-for="item in editor.uploadQueue.value"
                :key="item.name"
                class="flex items-center justify-between"
              >
                <span>{{ item.name }}</span>
                <Tag :variant="uploadStageVariant(item.stage)" class="text-[10px]">
                  {{ item.stage }}
                </Tag>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <div class="flex justify-between items-center text-xs text-muted-foreground shrink-0">
          <div>
            服务器资源 {{ resources.resources.value.length - resources.missingCount.value }} 个，引用中
            {{ resources.usedCount.value }} 个<template v-if="resources.missingCount.value">
              ，失效引用 {{ resources.missingCount.value }} 个
            </template>
          </div>
          <div class="flex items-center gap-2">
            <Button size="sm" variant="outline" class="h-7 text-xs" @click="editor.normalizeRichTextImagesFile">
              整理富文本引用
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-7"
                    :disabled="resources.isLoading.value"
                    aria-label="刷新资源"
                    @click="resources.loadResources"
                  >
                    <RefreshOutline class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent> 刷新资源 </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <Tabs :model-value="resources.currentView.value" class="w-full shrink-0" @update:model-value="(val) => (resources.currentView.value = val as any)">
          <TabsList class="h-8 w-full justify-start">
            <TabsTrigger value="all" class="text-xs"> 全部 {{ resources.resources.value.length }} </TabsTrigger>
            <TabsTrigger value="used" class="text-xs"> 引用中 {{ resources.usedCount.value }} </TabsTrigger>
            <TabsTrigger value="unused" class="text-xs"> 未使用 {{ resources.unusedCount.value }} </TabsTrigger>
          </TabsList>
        </Tabs>

        <Alert v-if="resources.loadError.value" variant="destructive" class="text-xs py-2 shrink-0">
          <AlertDescription>{{ resources.loadError.value }}</AlertDescription>
        </Alert>

        <div class="flex-1 min-h-0 overflow-y-auto relative">
          <div v-if="resources.isLoading.value" class="py-12 flex items-center justify-center">
            <Spin />
          </div>
          <div v-else-if="resources.visibleResources.value.length" class="space-y-2 pr-1">
            <div
              v-for="file in resources.visibleResources.value"
              :key="file.id"
              class="resource-row p-3 rounded-lg border bg-card/60 flex flex-col gap-2"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <Popover v-if="isImagePath(file.path) && !file.missing">
                    <PopoverTrigger as-child>
                      <img
                        :src="file.path"
                        :alt="file.name || `资源 ${file.id}`"
                        referrerpolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        class="resource-thumbnail size-11 rounded object-cover cursor-pointer border"
                        @load="readImageDimensions(file.id, $event)"
                      />
                    </PopoverTrigger>
                    <PopoverContent class="p-1 max-w-[320px] max-h-[320px] overflow-hidden">
                      <img
                        :src="file.path"
                        :alt="file.name"
                        referrerpolicy="no-referrer"
                        class="w-full h-full object-contain"
                      />
                    </PopoverContent>
                  </Popover>
                  <div
                    v-else
                    class="resource-thumbnail resource-placeholder size-11 rounded border bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-mono"
                  >
                    #{{ file.id }}
                  </div>
                  <div class="resource-main flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <strong class="text-xs text-foreground truncate">
                        {{ file.name || `资源 #${file.id}` }}
                      </strong>
                      <Tag v-if="file.missing" variant="destructive" class="text-[10px]">
                        文件已失效
                      </Tag>
                      <Tag v-else :variant="file.locations.length ? 'default' : 'secondary'" class="text-[10px]">
                        {{ file.locations.length ? `引用 ${file.locations.length} 处` : '未使用' }}
                      </Tag>
                    </div>
                    <div class="text-[11px] text-muted-foreground mt-0.5">
                      #{{ file.id }} · {{ formatBytes(file.size) }}
                      <template v-if="imageDimensions[file.id]"> · {{ imageDimensions[file.id] }} </template>
                    </div>
                    <div class="text-[11px] text-muted-foreground truncate font-mono">
                      {{ file.path || '无公开地址' }}
                    </div>
                  </div>
                </div>

                <div v-if="!file.missing" class="flex items-center gap-1 shrink-0">
                  <TooltipProvider>
                    <Tooltip v-if="file.path">
                      <TooltipTrigger as-child>
                        <Button
                          size="icon"
                          variant="ghost"
                          class="size-7"
                          aria-label="复制资源链接"
                          @click="copyResourcePath(file.path)"
                        >
                          <CopyOutline class="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent> 复制资源链接 </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon"
                          variant="ghost"
                          class="size-7 text-destructive hover:text-destructive"
                          aria-label="删除资源"
                          :disabled="resources.deletingId.value === file.id"
                          @click="confirmDelete(file)"
                        >
                          <TrashOutline class="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent> 删除资源 </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <div v-if="file.locations.length" class="text-[11px] text-muted-foreground bg-muted/40 p-1.5 rounded">
                {{ file.locations.join('；') }}
              </div>
            </div>
          </div>
          <div v-else class="py-12 text-center text-xs text-muted-foreground">
            当前分类没有资源
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
