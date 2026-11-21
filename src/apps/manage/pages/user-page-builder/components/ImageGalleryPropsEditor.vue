<script setup lang="ts">
import { GripVertical, Image as ImageIcon, Plus, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { isBlockPropertyAvailable } from '@/apps/user-page/block/propertyCapabilities'
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
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

const previewGallery = computed(() =>
  itemsModel.value.map((it) => getItemPreviewSrc(it)).filter((src): src is string => Boolean(src)),
)

function getGalleryIndex(src: string) {
  const idx = previewGallery.value.indexOf(src)
  return idx >= 0 ? idx : 0
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
      <FormField label="样式">
        <Select v-model="gallery.layout">
          <SelectTrigger>
            <SelectValue placeholder="选择样式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">网格</SelectItem>
            <SelectItem value="masonry">瀑布流</SelectItem>
            <SelectItem value="carousel">轮播</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        v-if="propertyAvailable('columns')"
        label="列数"
      >
        <NumberField
          v-model="gallery.columns"
          :min="1"
          :max="12"
        />
      </FormField>

      <FormField
        v-if="propertyAvailable('gap')"
        label="间距 px"
      >
        <NumberField
          v-model="gallery.gap"
          :min="0"
          :max="80"
        />
      </FormField>

      <FormField label="最大宽度">
        <Input
          v-model="gallery.maxWidth"
          placeholder="例如 100% 或 720px"
        />
      </FormField>

      <FormField
        v-if="propertyAvailable('maxHeight')"
        label="图片最大高度"
      >
        <Input
          v-model="gallery.maxHeight"
          placeholder="例如 320px"
        />
      </FormField>

      <FormField
        v-if="propertyAvailable('fit')"
        label="图片裁剪方式"
      >
        <Select v-model="gallery.fit">
          <SelectTrigger>
            <SelectValue placeholder="裁剪方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">裁剪铺满 - cover</SelectItem>
            <SelectItem value="contain">完整显示 - contain</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <SettingRow
        v-if="propertyAvailable('autoplay')"
        title="自动轮播"
        variant="none"
        class="pt-4"
      >
        <Switch
          :checked="gallery.autoplay"
          @update:checked="gallery.autoplay = $event"
        />
      </SettingRow>
    </PropsGrid>

    <template v-if="gallery.layout === 'carousel'">
      <PropsGrid>
        <FormField
          v-if="propertyAvailable('effect')"
          label="切换动效"
        >
          <Select v-model="gallery.effect">
            <SelectTrigger>
              <SelectValue placeholder="动效" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slide">滑动 - slide</SelectItem>
              <SelectItem value="fade">淡入淡出 - fade</SelectItem>
              <SelectItem value="card">卡片 - card</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          v-if="propertyAvailable('interval')"
          label="轮播间隔 ms"
        >
          <NumberField
            v-model="gallery.interval"
            :min="1000"
            :max="60000"
          />
        </FormField>

        <SettingRow
          v-if="propertyAvailable('showDots')"
          title="显示指示点"
          variant="none"
          class="pt-4"
        >
          <Switch
            :checked="gallery.showDots"
            @update:checked="gallery.showDots = $event"
          />
        </SettingRow>

        <SettingRow
          v-if="propertyAvailable('showArrow')"
          title="显示切换箭头"
          variant="none"
          class="pt-4"
        >
          <Switch
            :checked="gallery.showArrow"
            @update:checked="gallery.showArrow = $event"
          />
        </SettingRow>

        <FormField
          v-if="propertyAvailable('dotType')"
          label="指示点样式"
        >
          <Select v-model="gallery.dotType">
            <SelectTrigger>
              <SelectValue placeholder="样式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">短线</SelectItem>
              <SelectItem value="dot">圆点</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          v-if="propertyAvailable('dotPlacement')"
          label="指示点位置"
        >
          <Select v-model="gallery.dotPlacement">
            <SelectTrigger>
              <SelectValue placeholder="位置" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bottom">底部</SelectItem>
              <SelectItem value="top">顶部</SelectItem>
              <SelectItem value="left">左侧</SelectItem>
              <SelectItem value="right">右侧</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <SettingRow
          title="循环播放"
          variant="none"
          class="pt-4"
        >
          <Switch
            :checked="gallery.loop"
            @update:checked="gallery.loop = $event"
          />
        </SettingRow>

        <SettingRow
          title="鼠标拖拽切换"
          variant="none"
          class="pt-4"
        >
          <Switch
            :checked="gallery.draggable"
            @update:checked="gallery.draggable = $event"
          />
        </SettingRow>

        <SettingRow
          title="触屏滑动切换"
          variant="none"
          class="pt-4"
        >
          <Switch
            :checked="gallery.touchable"
            @update:checked="gallery.touchable = $event"
          />
        </SettingRow>

        <FormField label="切换触发方式">
          <Select v-model="gallery.trigger">
            <SelectTrigger>
              <SelectValue placeholder="方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="click">点击</SelectItem>
              <SelectItem value="hover">悬停</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </PropsGrid>
    </template>

    <div class="flex flex-col gap-2 pt-2 border-t border-border">
      <div class="flex-between">
        <span class="text-xs text-muted-foreground">图片列表（可拖拽排序）</span>
        <Button
          variant="outline"
          :disabled="props.editor.isUploading.value"
          @click="props.editor.triggerUploadGalleryBulk(props.block)"
        >
          <component
            :is="ImageIcon"
            class="size-3.5 mr-1"
          />
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
          <div class="flex-between">
            <div class="flex items-center gap-2 min-w-0">
              <GripVertical class="drag-handle size-3.5 cursor-grab text-muted-foreground shrink-0" />
              <ImagePreview
                v-if="getItemPreviewSrc(element)"
                :src="getItemPreviewSrc(element)"
                :alt="element.alt || element.desc || `图片 #${index + 1}`"
                :gallery="previewGallery"
                :index="getGalleryIndex(getItemPreviewSrc(element))"
                class="size-10 rounded border-border shrink-0"
              />
              <span class="text-xs text-muted-foreground font-mono">#{{ index + 1 }}</span>
            </div>

            <div class="flex items-center gap-1.5">
              <Button
                size="xs"
                variant="outline"
                :disabled="props.editor.isUploading.value"
                @click="props.editor.triggerUploadItemImage(props.block, index)"
              >
                上传
              </Button>
              <Button
                size="xs"
                variant="ghost"
                @click="props.editor.clearUploadedItemImage(props.block, index)"
              >
                清除
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                class="text-destructive hover:text-destructive"
                aria-label="删除图片"
                @click="removeItem(index)"
              >
                <Trash2 class="size-3.5" />
              </Button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5 pt-1">
            <Input
              v-model="ensureItem(index).alt"
              placeholder="替代文本（说明图片内容；装饰图片可留空）"
              size="xs"
            />
            <Input
              v-model="ensureItem(index).desc"
              placeholder="图片描述（可选，显示在图片下方）"
              size="xs"
            />
          </div>
        </div>
      </VueDraggable>

      <Button
        variant="outline"
        class="w-full"
        @click="addItem"
      >
        <component
          :is="Plus"
          class="size-3.5 mr-1"
        />
        添加图片
      </Button>
    </div>
  </div>
</template>
