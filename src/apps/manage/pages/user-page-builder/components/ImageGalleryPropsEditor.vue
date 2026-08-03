<script setup lang="ts">
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { isBlockPropertyAvailable } from '@/apps/user-page/block/propertyCapabilities'
import type { BlockNode } from '@/apps/user-page/block/schema'

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
  <div class="builder-form">
    <PropsGrid>
      <UFormField label="样式">
        <USelect
          v-model="gallery.layout"
          :items="[
            { label: '网格', value: 'grid' },
            { label: '瀑布流', value: 'masonry' },
            { label: '轮播', value: 'carousel' },
          ]"
        />
      </UFormField>

      <UFormField
        v-if="propertyAvailable('columns')"
        label="列数"
      >
        <UInputNumber
          v-model="gallery.columns"
          :min="1"
          :max="12"
          style="width: 100%"
        />
      </UFormField>

      <UFormField
        v-if="propertyAvailable('gap')"
        label="间距 px"
      >
        <UInputNumber
          v-model="gallery.gap"
          :min="0"
          :max="80"
          style="width: 100%"
        />
      </UFormField>

      <UFormField label="最大宽度">
        <UInput
          v-model="gallery.maxWidth"
          placeholder="例如 100% 或 720px"
        />
      </UFormField>

      <UFormField
        v-if="propertyAvailable('maxHeight')"
        label="图片最大高度"
      >
        <UInput
          v-model="gallery.maxHeight"
          placeholder="例如 320px"
        />
      </UFormField>

      <UFormField
        v-if="propertyAvailable('fit')"
        label="图片裁剪方式"
      >
        <USelect
          v-model="gallery.fit"
          :items="[
            { label: '裁剪铺满 - cover', value: 'cover' },
            { label: '完整显示 - contain', value: 'contain' },
          ]"
        />
      </UFormField>

      <UFormField
        v-if="propertyAvailable('autoplay')"
        label="自动轮播"
      >
        <div class="builder-row">
          <USwitch
            v-model="gallery.autoplay"
            size="small"
          />
        </div>
      </UFormField>
    </PropsGrid>

    <template v-if="gallery.layout === 'carousel'">
      <PropsGrid>
        <UFormField
          v-if="propertyAvailable('effect')"
          label="切换动效"
        >
          <USelect
            v-model="gallery.effect"
            :items="[
              { label: '滑动 - slide', value: 'slide' },
              { label: '淡入淡出 - fade', value: 'fade' },
              { label: '卡片 - card', value: 'card' },
            ]"
          />
        </UFormField>

        <UFormField
          v-if="propertyAvailable('interval')"
          label="轮播间隔 ms"
        >
          <UInputNumber
            v-model="gallery.interval"
            :min="1000"
            :max="20000"
            style="width: 100%"
          />
        </UFormField>

        <UFormField
          v-if="propertyAvailable('showDots')"
          label="显示指示点"
        >
          <div class="builder-row">
            <USwitch
              v-model="gallery.showDots"
              size="small"
            />
          </div>
        </UFormField>

        <UFormField
          v-if="propertyAvailable('showArrow')"
          label="显示切换箭头"
        >
          <div class="builder-row">
            <USwitch
              v-model="gallery.showArrow"
              size="small"
            />
          </div>
        </UFormField>

        <UFormField
          v-if="propertyAvailable('dotType')"
          label="指示点样式"
        >
          <USelect
            v-model="gallery.dotType"
            :items="[
              { label: '短线', value: 'line' },
              { label: '圆点', value: 'dot' },
            ]"
          />
        </UFormField>

        <UFormField
          v-if="propertyAvailable('dotPlacement')"
          label="指示点位置"
        >
          <USelect
            v-model="gallery.dotPlacement"
            :items="[
              { label: '底部', value: 'bottom' },
              { label: '顶部', value: 'top' },
              { label: '左侧', value: 'left' },
              { label: '右侧', value: 'right' },
            ]"
          />
        </UFormField>

        <UFormField label="循环播放">
          <div class="builder-row">
            <USwitch
              v-model="gallery.loop"
              size="small"
            />
          </div>
        </UFormField>

        <UFormField label="鼠标拖拽切换">
          <div class="builder-row">
            <USwitch
              v-model="gallery.draggable"
              size="small"
            />
          </div>
        </UFormField>

        <UFormField label="触屏滑动切换">
          <div class="builder-row">
            <USwitch
              v-model="gallery.touchable"
              size="small"
            />
          </div>
        </UFormField>

        <UFormField label="切换触发方式">
          <USelect
            v-model="gallery.trigger"
            :items="[
              { label: '点击', value: 'click' },
              { label: '悬停', value: 'hover' },
            ]"
          />
        </UFormField>
      </PropsGrid>
    </template>

    <UFormField label="图片列表">
      <div
        class="builder-stack"
        style="width: 100%"
      >
        <div class="builder-row">
          <span class="builder-text"> 可拖拽排序 </span>
          <UButton
            size="xs"
            color="info"
            variant="soft"
            :loading="props.editor.isUploading.value"
            @click="props.editor.triggerUploadGalleryBulk(props.block)"
          >
            <template #icon>
              <UIcon name="i-lucide-image" />
            </template>
            批量上传
          </UButton>
        </div>
        <VueDraggable
          v-model="itemsModel"
          handle=".drag-handle"
          style="display: flex; flex-direction: column; gap: 10px"
        >
          <div
            v-for="(element, index) in itemsModel"
            :key="getItemKey(element)"
            style="border: 1px solid var(--vtsuru-border); border-radius: 10px; padding: 10px"
          >
            <div class="builder-row">
              <div
                class="builder-row"
                style="gap: 10px; min-width: 0"
              >
                <span
                  class="builder-text drag-handle"
                  style="cursor: grab; user-select: none"
                >
                  ≡
                </span>
                <img
                  v-if="getItemPreviewSrc(element)"
                  :src="getItemPreviewSrc(element)"
                  alt=""
                  referrerpolicy="no-referrer"
                  style="
                    width: 44px;
                    height: 44px;
                    object-fit: cover;
                    border-radius: 8px;
                    border: 1px solid var(--vtsuru-border);
                    flex: 0 0 auto;
                  "
                />
                <span
                  class="builder-text"
                  style="white-space: nowrap"
                >
                  #{{ index + 1 }}
                </span>
              </div>
              <div
                class="builder-row"
                style="gap: 8px"
              >
                <UButton
                  size="xs"
                  :loading="props.editor.isUploading.value"
                  @click="props.editor.triggerUploadItemImage(props.block, index)"
                >
                  <template #icon>
                    <UIcon name="i-lucide-image" />
                  </template>
                  上传
                </UButton>
                <UButton
                  size="xs"
                  variant="soft"
                  @click="props.editor.clearUploadedItemImage(props.block, index)"
                >
                  清除
                </UButton>
                <UButton
                  size="xs"
                  color="error"
                  variant="soft"
                  @click="removeItem(index)"
                >
                  <template #icon>
                    <UIcon name="i-lucide-trash-2" />
                  </template>
                  删除
                </UButton>
              </div>
            </div>

            <div style="margin-top: 10px">
              <UFormField
                label="替代文本"
                :show-feedback="false"
              >
                <UInput
                  v-model="ensureItem(index).alt"
                  placeholder="说明图片内容；装饰图片可留空"
                />
              </UFormField>
              <UFormField
                label="图片描述"
                :show-feedback="false"
              >
                <UInput
                  v-model="ensureItem(index).desc"
                  placeholder="可选，显示在图片下方"
                />
              </UFormField>
            </div>
          </div>
        </VueDraggable>

        <UButton
          color="info"
          variant="soft"
          @click="addItem"
        >
          <template #icon>
            <UIcon name="i-lucide-plus" />
          </template>
          添加图片
        </UButton>
      </div>
    </UFormField>
  </div>
</template>
