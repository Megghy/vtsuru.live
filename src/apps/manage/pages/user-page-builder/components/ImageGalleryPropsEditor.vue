<script setup lang="ts">
import { AddOutline, ImageOutline, TrashOutline } from '@vicons/ionicons5'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { isBlockPropertyAvailable } from '@/apps/user-page/block/propertyCapabilities'
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { NInputNumber } from '@/shared/ui/NInputNumber'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from './PropsGrid.vue'

const props = defineProps<{
  block: BlockNode
  editor: {
    isUploading: { value: boolean }
    ensureImageGalleryProps: (block: BlockNode) => Record<string, any>
    triggerUploadItemImage: (block: BlockNode, itemIndex: number) => void
    triggerUploadGalleryBulk: (block: BlockNode) => void
    clearUploadedItemImage: (block: BlockNode, itemIndex: number) => void
  }
}>()

const gallery = computed(() => props.editor.ensureImageGalleryProps(props.block))
const itemsModel = computed({
  get() {
    return gallery.value.items as any[]
  },
  set(v: any[]) {
    gallery.value.items = v
  },
})

function ensureItem(idx: number) {
  const it = itemsModel.value[idx]
  if (!it || typeof it !== 'object' || Array.isArray(it)) {
    itemsModel.value[idx] = { desc: '', alt: '' }
  }
  const obj = itemsModel.value[idx]
  if (typeof obj.desc !== 'string') obj.desc = ''
  if (typeof obj.alt !== 'string') obj.alt = ''
  return obj
}

function addItem() {
  itemsModel.value.push({ desc: '', alt: '' })
}

function removeItem(idx: number) {
  itemsModel.value.splice(idx, 1)
}

function getItemPreviewSrc(it: any) {
  const file = it?.imageFile
  if (file && typeof file === 'object' && !Array.isArray(file) && typeof file.path === 'string' && file.path)
    return file.path
  return ''
}

function getItemKey(it: any) {
  if (!it || typeof it !== 'object') return String(it ?? '')
  const fileId = it?.imageFile?.id
  if (typeof fileId === 'number' && Number.isInteger(fileId) && fileId > 0) return `file:${fileId}`
  if (typeof it._k !== 'string') {
    Object.defineProperty(it, '_k', {
      value: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
      enumerable: false,
    })
  }
  return it._k as string
}

function propertyAvailable(property: string) {
  return isBlockPropertyAvailable(props.block.type, gallery.value, property)
}
</script>

<template>
  <div class="image-gallery-props-editor flex flex-col gap-3">
    <PropsGrid>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">样式</label>
        <Select v-model="gallery.layout">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="选择样式" />
          </SelectTrigger>
          <SelectContent class="text-xs">
            <SelectItem value="grid">网格</SelectItem>
            <SelectItem value="masonry">瀑布流</SelectItem>
            <SelectItem value="carousel">轮播</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="propertyAvailable('columns')" class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">列数</label>
        <NInputNumber
          v-model="gallery.columns"
          :min="1"
          :max="12"
          class="h-8 text-xs"
        />
      </div>

      <div v-if="propertyAvailable('gap')" class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">间距 px</label>
        <NInputNumber
          v-model="gallery.gap"
          :min="0"
          :max="80"
          class="h-8 text-xs"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">最大宽度</label>
        <Input
          v-model="gallery.maxWidth"
          placeholder="例如 100% 或 720px"
          class="h-8 text-xs"
        />
      </div>

      <div v-if="propertyAvailable('maxHeight')" class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">图片最大高度</label>
        <Input
          v-model="gallery.maxHeight"
          placeholder="例如 320px"
          class="h-8 text-xs"
        />
      </div>

      <div v-if="propertyAvailable('fit')" class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground">图片裁剪方式</label>
        <Select v-model="gallery.fit">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="裁剪方式" />
          </SelectTrigger>
          <SelectContent class="text-xs">
            <SelectItem value="cover">裁剪铺满 - cover</SelectItem>
            <SelectItem value="contain">完整显示 - contain</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="propertyAvailable('autoplay')" class="flex items-center justify-between pt-4">
        <label class="text-xs text-muted-foreground">自动轮播</label>
        <Switch :checked="gallery.autoplay" @update:checked="gallery.autoplay = $event" />
      </div>
    </PropsGrid>

    <template v-if="gallery.layout === 'carousel'">
      <PropsGrid>
        <div v-if="propertyAvailable('effect')" class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">切换动效</label>
          <Select v-model="gallery.effect">
            <SelectTrigger class="h-8 text-xs">
              <SelectValue placeholder="动效" />
            </SelectTrigger>
            <SelectContent class="text-xs">
              <SelectItem value="slide">滑动 - slide</SelectItem>
              <SelectItem value="fade">淡入淡出 - fade</SelectItem>
              <SelectItem value="card">卡片 - card</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="propertyAvailable('interval')" class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">轮播间隔 ms</label>
          <NInputNumber
            v-model="gallery.interval"
            :min="1000"
            :max="20000"
            class="h-8 text-xs"
          />
        </div>

        <div v-if="propertyAvailable('showDots')" class="flex items-center justify-between pt-4">
          <label class="text-xs text-muted-foreground">显示指示点</label>
          <Switch :checked="gallery.showDots" @update:checked="gallery.showDots = $event" />
        </div>

        <div v-if="propertyAvailable('showArrow')" class="flex items-center justify-between pt-4">
          <label class="text-xs text-muted-foreground">显示切换箭头</label>
          <Switch :checked="gallery.showArrow" @update:checked="gallery.showArrow = $event" />
        </div>

        <div v-if="propertyAvailable('dotType')" class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">指示点样式</label>
          <Select v-model="gallery.dotType">
            <SelectTrigger class="h-8 text-xs">
              <SelectValue placeholder="样式" />
            </SelectTrigger>
            <SelectContent class="text-xs">
              <SelectItem value="line">短线</SelectItem>
              <SelectItem value="dot">圆点</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="propertyAvailable('dotPlacement')" class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">指示点位置</label>
          <Select v-model="gallery.dotPlacement">
            <SelectTrigger class="h-8 text-xs">
              <SelectValue placeholder="位置" />
            </SelectTrigger>
            <SelectContent class="text-xs">
              <SelectItem value="bottom">底部</SelectItem>
              <SelectItem value="top">顶部</SelectItem>
              <SelectItem value="left">左侧</SelectItem>
              <SelectItem value="right">右侧</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex items-center justify-between pt-4">
          <label class="text-xs text-muted-foreground">循环播放</label>
          <Switch :checked="gallery.loop" @update:checked="gallery.loop = $event" />
        </div>

        <div class="flex items-center justify-between pt-4">
          <label class="text-xs text-muted-foreground">鼠标拖拽切换</label>
          <Switch :checked="gallery.draggable" @update:checked="gallery.draggable = $event" />
        </div>

        <div class="flex items-center justify-between pt-4">
          <label class="text-xs text-muted-foreground">触屏滑动切换</label>
          <Switch :checked="gallery.touchable" @update:checked="gallery.touchable = $event" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">切换触发方式</label>
          <Select v-model="gallery.trigger">
            <SelectTrigger class="h-8 text-xs">
              <SelectValue placeholder="方式" />
            </SelectTrigger>
            <SelectContent class="text-xs">
              <SelectItem value="click">点击</SelectItem>
              <SelectItem value="hover">悬停</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PropsGrid>
    </template>

    <div class="flex flex-col gap-2 pt-2 border-t border-border">
      <div class="flex items-center justify-between">
        <span class="text-xs text-muted-foreground">图片列表（可拖拽排序）</span>
        <Button
          size="sm"
          variant="outline"
          class="h-7 text-xs"
          :disabled="props.editor.isUploading.value"
          @click="props.editor.triggerUploadGalleryBulk(props.block)"
        >
          <component :is="ImageOutline" class="size-3.5 mr-1" />
          批量上传
        </Button>
      </div>

      <VueDraggable
        v-model="itemsModel"
        handle=".drag-handle"
        class="flex flex-col gap-2"
      >
        <div
          v-for="(element, index) in itemsModel"
          :key="getItemKey(element)"
          class="border border-border rounded-lg p-2.5 bg-card flex flex-col gap-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 min-w-0">
              <span class="drag-handle cursor-grab text-muted-foreground font-mono select-none">≡</span>
              <img
                v-if="getItemPreviewSrc(element)"
                :src="getItemPreviewSrc(element)"
                alt=""
                referrerpolicy="no-referrer"
                class="size-10 object-cover rounded border border-border shrink-0"
              />
              <span class="text-xs text-muted-foreground font-mono">#{{ index + 1 }}</span>
            </div>

            <div class="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                class="h-6 px-2 text-xs"
                :disabled="props.editor.isUploading.value"
                @click="props.editor.triggerUploadItemImage(props.block, index)"
              >
                上传
              </Button>
              <Button
                size="sm"
                variant="ghost"
                class="h-6 px-2 text-xs"
                @click="props.editor.clearUploadedItemImage(props.block, index)"
              >
                清除
              </Button>
              <Button
                size="sm"
                variant="ghost"
                class="h-6 px-2 text-xs text-destructive hover:text-destructive"
                @click="removeItem(index)"
              >
                <component :is="TrashOutline" class="size-3.5" />
              </Button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5 pt-1">
            <Input
              v-model="ensureItem(index).alt"
              placeholder="替代文本（说明图片内容；装饰图片可留空）"
              class="h-7 text-xs"
            />
            <Input
              v-model="ensureItem(index).desc"
              placeholder="图片描述（可选，显示在图片下方）"
              class="h-7 text-xs"
            />
          </div>
        </div>
      </VueDraggable>

      <Button
        size="sm"
        variant="outline"
        class="w-full text-xs"
        @click="addItem"
      >
        <component :is="AddOutline" class="size-3.5 mr-1" />
        添加图片
      </Button>
    </div>
  </div>
</template>
