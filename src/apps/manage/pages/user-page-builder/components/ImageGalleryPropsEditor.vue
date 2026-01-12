<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import draggable from 'vuedraggable-es'
import { AddOutline, ImageOutline, TrashOutline } from '@vicons/ionicons5'
import { NButton, NFlex, NForm, NFormItem, NIcon, NInput, NInputNumber, NSelect, NSpace, NSwitch, NText } from 'naive-ui'
import { computed } from 'vue'
import PropsGrid from './PropsGrid.vue'

const props = defineProps<{
  block: BlockNode
  editor: {
    isUploading: { value: boolean }
    ensureImageGalleryProps: (block: BlockNode) => Record<string, any>
    triggerUploadGalleryItem: (block: BlockNode, itemIndex: number) => void
    triggerUploadGalleryBulk: (block: BlockNode) => void
    clearUploadedGalleryItemFile: (block: BlockNode, itemIndex: number) => void
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
    itemsModel.value[idx] = { desc: '' }
  }
  const obj = itemsModel.value[idx]
  if (typeof obj.desc !== 'string') obj.desc = ''
  return obj
}

function addItem() {
  itemsModel.value.push({ desc: '' })
}

function removeItem(idx: number) {
  itemsModel.value.splice(idx, 1)
}

function getItemPreviewSrc(it: any) {
  const file = it?.imageFile
  if (file && typeof file === 'object' && !Array.isArray(file) && typeof file.path === 'string' && file.path) return file.path
  return ''
}

function getItemKey(it: any) {
  const fileId = it?.imageFile?.id
  if (typeof fileId === 'number' && Number.isInteger(fileId) && fileId > 0) return `file:${fileId}`
  return JSON.stringify(it ?? {})
}
</script>

<template>
  <NForm label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="样式">
        <NSelect
          v-model:value="gallery.layout"
          :options="[
            { label: '网格', value: 'grid' },
            { label: '瀑布流', value: 'masonry' },
            { label: '轮播', value: 'carousel' },
          ]"
        />
      </NFormItem>

      <NFormItem v-if="gallery.layout !== 'carousel'" label="列数">
        <NInputNumber v-model:value="gallery.columns" :min="1" :max="12" style="width: 100%" />
      </NFormItem>

      <NFormItem v-if="gallery.layout !== 'carousel'" label="间距 gap（px）">
        <NInputNumber v-model:value="gallery.gap" :min="0" :max="80" style="width: 100%" />
      </NFormItem>

      <NFormItem label="最大宽度（可选）">
        <NInput v-model:value="gallery.maxWidth" placeholder="例如 100% 或 720px" />
      </NFormItem>

      <NFormItem v-if="gallery.layout !== 'masonry'" label="图片最大高度（可选）">
        <NInput v-model:value="gallery.maxHeight" placeholder="例如 320px" />
      </NFormItem>

      <NFormItem v-if="gallery.layout !== 'masonry'" label="图片裁剪方式">
        <NSelect
          v-model:value="gallery.fit"
          :options="[
            { label: '裁剪铺满（cover）', value: 'cover' },
            { label: '完整显示（contain）', value: 'contain' },
          ]"
        />
      </NFormItem>

      <NFormItem v-if="gallery.layout === 'carousel'" label="自动轮播">
        <NFlex justify="end">
          <NSwitch v-model:value="gallery.autoplay" size="small" />
        </NFlex>
      </NFormItem>
    </PropsGrid>

    <template v-if="gallery.layout === 'carousel'">
      <PropsGrid>
        <NFormItem label="切换动效">
          <NSelect
            v-model:value="gallery.effect"
            :options="[
              { label: '滑动（slide）', value: 'slide' },
              { label: '淡入淡出（fade）', value: 'fade' },
              { label: '卡片（card）', value: 'card' },
            ]"
          />
        </NFormItem>

        <NFormItem v-if="gallery.autoplay" label="轮播间隔（ms）">
          <NInputNumber v-model:value="gallery.interval" :min="1000" :max="20000" style="width: 100%" />
        </NFormItem>

        <NFormItem label="显示指示点">
          <NFlex justify="end">
            <NSwitch v-model:value="gallery.showDots" size="small" />
          </NFlex>
        </NFormItem>

        <NFormItem v-if="gallery.showDots" label="指示点位置">
          <NSelect
            v-model:value="gallery.dotPlacement"
            :options="[
              { label: '底部', value: 'bottom' },
              { label: '顶部', value: 'top' },
              { label: '左侧', value: 'left' },
              { label: '右侧', value: 'right' },
            ]"
          />
        </NFormItem>
      </PropsGrid>
    </template>

    <NFormItem label="图片列表">
      <NSpace vertical style="width: 100%">
        <NFlex justify="space-between" align="center" :wrap="false">
          <NText depth="3">可拖拽排序</NText>
          <NButton size="tiny" type="info" secondary :loading="props.editor.isUploading.value" @click="props.editor.triggerUploadGalleryBulk(props.block)">
            <template #icon>
              <NIcon><ImageOutline /></NIcon>
            </template>
            批量上传
          </NButton>
        </NFlex>
        <draggable
          v-model="itemsModel"
          :item-key="getItemKey"
          handle=".drag-handle"
          style="display:flex; flex-direction: column; gap: 10px"
        >
          <template #item="{ element, index }">
            <div style="border: 1px solid var(--n-border-color); border-radius: 10px; padding: 10px">
                <NFlex align="center" justify="space-between">
                  <NFlex align="center" :wrap="false" style="gap: 10px; min-width: 0">
                    <NText depth="3" class="drag-handle" style="cursor: grab; user-select: none">≡</NText>
                    <img
                      v-if="getItemPreviewSrc(element)"
                      :src="getItemPreviewSrc(element)"
                      alt=""
                      referrerpolicy="no-referrer"
                      style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px; border: 1px solid var(--n-border-color); flex: 0 0 auto"
                    >
                    <NText depth="3" style="white-space: nowrap">#{{ index + 1 }}</NText>
                  </NFlex>
                  <NFlex align="center" :wrap="false" style="gap: 8px">
                    <NButton size="tiny" :loading="props.editor.isUploading.value" @click="props.editor.triggerUploadGalleryItem(props.block, index)">
                      <template #icon>
                        <NIcon><ImageOutline /></NIcon>
                      </template>
                      上传
                    </NButton>
                    <NButton size="tiny" secondary @click="props.editor.clearUploadedGalleryItemFile(props.block, index)">清除</NButton>
                    <NButton size="tiny" type="error" secondary @click="removeItem(index)">
                      <template #icon>
                        <NIcon><TrashOutline /></NIcon>
                      </template>
                      删除
                    </NButton>
                  </NFlex>
                </NFlex>

                <div style="margin-top: 10px">
                  <NFormItem label="图片描述（显示在图片下方）" :show-feedback="false">
                    <NInput v-model:value="ensureItem(index).desc" placeholder="可选" />
                  </NFormItem>
                </div>
              </div>
          </template>
        </draggable>

        <NButton type="info" secondary @click="addItem">
          <template #icon>
            <NIcon><AddOutline /></NIcon>
          </template>
          添加图片
        </NButton>
      </NSpace>
    </NFormItem>
  </NForm>
</template>
