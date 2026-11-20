<script setup lang="ts">
import Delete24Regular from '@vicons/fluent/es/Delete24Regular'
import Image24Regular from '@vicons/fluent/es/Image24Regular'
import ArrowClockwise24Regular from '@vicons/fluent/es/ArrowClockwise24Regular'
import { ZoomIn } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  cleanupUnusedPngtuberAssets,
  deletePngtuberAsset,
  listPngtuberAssets,
  type PngtuberAssetItem,
} from '@/api/pngtuber-assets'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { ImageLightbox } from '@/shared/ui/image-preview'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Spin } from '@/shared/ui/spin'

const props = withDefaults(
  defineProps<{
    open: boolean
    selectable?: boolean
    currentUrl?: string
  }>(),
  { selectable: true, currentUrl: '' },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [url: string]
}>()

const loading = ref(false)
const cleaning = ref(false)
const deletingId = ref('')
const assets = ref<PngtuberAssetItem[]>([])
const filter = ref<'all' | 'inUse' | 'unused'>('all')

const filteredAssets = computed(() => {
  if (filter.value === 'inUse') return assets.value.filter((a) => a.inUse)
  if (filter.value === 'unused') return assets.value.filter((a) => !a.inUse)
  return assets.value
})

const unusedCount = computed(() => assets.value.filter((a) => !a.inUse).length)
const totalBytes = computed(() => assets.value.reduce((acc, a) => acc + a.byteSize, 0))
const previewOpen = ref(false)
const previewIndex = ref(0)
const previewGallery = computed(() => filteredAssets.value.map((a) => ({ src: a.url, alt: a.assetId })))

function openPreview(idx: number) {
  previewIndex.value = idx
  previewOpen.value = true
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function load() {
  loading.value = true
  try {
    assets.value = await listPngtuberAssets()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) void load()
  },
)

function choose(asset: PngtuberAssetItem) {
  if (!props.selectable) return
  emit('select', asset.url)
  emit('update:open', false)
}

async function remove(asset: PngtuberAssetItem) {
  deletingId.value = asset.assetId
  try {
    await deletePngtuberAsset(asset.assetId, asset.inUse)
    assets.value = assets.value.filter((a) => a.assetId !== asset.assetId)
    toast.success('已删除素材（后台回收后释放配额）')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    deletingId.value = ''
  }
}

async function cleanupUnused() {
  cleaning.value = true
  try {
    const res = await cleanupUnusedPngtuberAssets()
    if (res.deletedCount > 0) {
      toast.success(`已清理 ${res.deletedCount} 个未引用素材，释放约 ${formatBytes(res.freedBytes)}`)
      await load()
    } else {
      toast.info('当前没有未引用的闲置素材')
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    cleaning.value = false
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="max-w-3xl max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Image24Regular class="size-4 text-brand" />
          {{ selectable ? '选择已上传素材' : '个人 PNGtuber 素材库' }}
        </DialogTitle>
        <DialogDescription>
          共 {{ assets.length }} 个素材，合计 {{ formatBytes(totalBytes) }}（含循环与单次播放版本），其中
          {{ unusedCount }} 个未被任何频道配置引用。
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-wrap items-center justify-between gap-2 py-1">
        <div class="flex items-center gap-1.5">
          <Button
            size="xs"
            :variant="filter === 'all' ? 'secondary' : 'ghost'"
            @click="filter = 'all'"
          >
            全部 ({{ assets.length }})
          </Button>
          <Button
            size="xs"
            :variant="filter === 'inUse' ? 'secondary' : 'ghost'"
            @click="filter = 'inUse'"
          >
            使用中 ({{ assets.length - unusedCount }})
          </Button>
          <Button
            size="xs"
            :variant="filter === 'unused' ? 'secondary' : 'ghost'"
            @click="filter = 'unused'"
          >
            未引用 ({{ unusedCount }})
          </Button>
        </div>

        <div class="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            class="gap-1"
            :disabled="loading"
            @click="load"
          >
            <ArrowClockwise24Regular class="size-3.5" />
            刷新
          </Button>
          <Popconfirm
            title="清理未引用素材"
            :disabled="cleaning || unusedCount === 0"
            @positive-click="cleanupUnused"
          >
            <template #trigger>
              <Button
                size="xs"
                variant="outline"
                class="border-destructive/40 text-destructive hover:bg-destructive/10"
                :disabled="cleaning || unusedCount === 0"
              >
                清理未引用 ({{ unusedCount }})
              </Button>
            </template>
            确认删除全部 {{ unusedCount }} 个未在任何频道配置中引用的素材？
          </Popconfirm>
        </div>
      </div>

      <Spin
        :show="loading"
        class="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1"
      >
        <div
          v-if="!loading && filteredAssets.length === 0"
          class="flex-col-center py-12 text-xs text-muted-foreground gap-2 border border-dashed border-border rounded-lg"
        >
          <Image24Regular class="size-8 opacity-40" />
          <span>暂无符合条件的素材</span>
        </div>

        <div
          v-else
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-1"
        >
          <div
            v-for="(asset, idx) in filteredAssets"
            :key="asset.assetId"
            class="group relative flex flex-col rounded-lg border bg-card overflow-hidden transition-colors"
            :class="[
              currentUrl && currentUrl.startsWith(asset.url)
                ? 'border-primary ring-1 ring-primary/40'
                : 'border-border hover:border-primary/50',
              selectable ? 'cursor-pointer' : '',
            ]"
            @click="choose(asset)"
          >
            <div
              class="relative h-28 flex-center p-2 bg-muted/50"
              :class="!selectable && 'cursor-zoom-in'"
              @click="!selectable && openPreview(idx)"
            >
              <img
                :src="asset.url"
                :alt="asset.assetId"
                loading="lazy"
                class="max-h-full max-w-full object-contain"
              />
              <Badge
                size="xs"
                :variant="asset.inUse ? 'success' : 'secondary'"
                class="pointer-events-none absolute top-1.5 left-1.5"
              >
                {{ asset.inUse ? '使用中' : '未引用' }}
              </Badge>
              <Badge
                v-if="asset.frameCount > 1"
                size="xs"
                variant="outline"
                class="pointer-events-none absolute top-1.5 right-1.5 bg-background/80 backdrop-blur-sm"
              >
                {{ asset.frameCount }}帧
              </Badge>
              <button
                type="button"
                aria-label="放大查看素材"
                title="放大查看素材"
                class="absolute bottom-1.5 right-1.5 size-6 rounded-full bg-black/55 text-white hover:bg-black/80 flex-center opacity-80 group-hover:opacity-100 transition-opacity cursor-zoom-in"
                @click.stop="openPreview(idx)"
              >
                <ZoomIn class="size-3.5" />
              </button>
            </div>

            <div class="p-2 flex items-center justify-between gap-1 text-[11px] text-muted-foreground border-t border-border/60">
              <div class="min-w-0 truncate">
                <div class="font-mono text-foreground">{{ asset.width }}×{{ asset.height }}</div>
                <div>{{ formatBytes(asset.byteSize) }}</div>
              </div>

              <div @click.stop>
                <Popconfirm
                  :title="asset.inUse ? '强制删除正在使用的素材' : '删除素材'"
                  @positive-click="remove(asset)"
                >
                  <template #trigger>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="text-muted-foreground hover:text-destructive shrink-0 px-1.5"
                      :disabled="deletingId === asset.assetId"
                      :aria-label="`删除素材 ${asset.assetId}`"
                    >
                      <Delete24Regular class="size-3.5" />
                    </Button>
                  </template>
                  {{
                    asset.inUse
                      ? '该素材正被某个频道引用，删除后对应立绘将无法加载，确认删除？'
                      : '删除此素材并释放存储空间？'
                  }}
                </Popconfirm>
              </div>
            </div>
          </div>
        </div>
      </Spin>

      <DialogFooter>
        <Button
          variant="outline"
          @click="emit('update:open', false)"
        >
          关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <ImageLightbox
    v-model:open="previewOpen"
    :imgs="previewGallery"
    :index="previewIndex"
  />
</template>
