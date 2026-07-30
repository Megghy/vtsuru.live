<script setup lang="ts">
import { ImageOutline } from '@vicons/ionicons5'
import { NButton, NDynamicTags, NFlex, NForm, NFormItem, NIcon, NInput, NInputNumber, NSelect } from 'naive-ui'

import type { BlockNode } from '@/apps/user-page/block/schema'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import CardActionEditor from './CardActionEditor.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps, ensureArrayProp, propertyAvailable, internalPageOptions } = useBlockPropsEditor(
  () => props.block,
)
const items = ensureArrayProp<Record<string, any>>('items')

function ensureAction(item: Record<string, any>, key: 'primaryAction' | 'secondaryAction') {
  item[key] ??= key === 'primaryAction' ? { label: '', page: 'home' } : { label: '', url: 'https://' }
  return item[key]
}
</script>

<template>
  <NForm
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem label="布局">
        <NSelect
          v-model:value="blockProps.layout"
          :options="[
            { label: '网格', value: 'grid' },
            { label: '列表', value: 'list' },
          ]"
        />
      </NFormItem>
      <NFormItem
        v-if="propertyAvailable('columns')"
        label="列数"
      >
        <NInputNumber
          v-model:value="blockProps.columns"
          :min="1"
          :max="4"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem
        class="span-full"
        label="卡片"
      >
        <RepeaterEditor
          :items="items"
          :create-item="
            () => ({
              title: '',
              body: '',
              tags: [],
              primaryAction: { label: '', page: 'home' },
              secondaryAction: { label: '', url: 'https://' },
            })
          "
          add-text="添加卡片"
        >
          <template #title="{ item, index }">
            {{ item.title || `卡片 ${index + 1}` }}
          </template>
          <template #default="{ item, index }">
            <PropsGrid>
              <NFormItem
                class="span-full"
                label="图片"
              >
                <NFlex align="center">
                  <NButton
                    size="small"
                    :loading="editor.isUploading.value"
                    @click="editor.triggerUploadItemImage(props.block, index)"
                  >
                    <template #icon>
                      <NIcon><ImageOutline /></NIcon>
                    </template>
                    选择图片
                  </NButton>
                  <NButton
                    size="small"
                    secondary
                    :disabled="!item.imageFile"
                    @click="editor.clearUploadedItemImage(props.block, index)"
                  >
                    清除
                  </NButton>
                  <img
                    v-if="item.imageFile?.path"
                    :src="item.imageFile.path"
                    alt=""
                    class="card-image-preview"
                  />
                </NFlex>
              </NFormItem>
              <NFormItem label="标题">
                <NInput
                  v-model:value="item.title"
                  maxlength="100"
                  show-count
                />
              </NFormItem>
              <NFormItem
                class="span-full"
                label="正文"
              >
                <NInput
                  v-model:value="item.body"
                  type="textarea"
                  maxlength="1000"
                  show-count
                  :autosize="{ minRows: 3, maxRows: 8 }"
                />
              </NFormItem>
              <NFormItem
                class="span-full"
                label="标签"
              >
                <NDynamicTags v-model:value="item.tags" />
              </NFormItem>
            </PropsGrid>
            <CardActionEditor
              :action="ensureAction(item, 'primaryAction')"
              :page-options="internalPageOptions"
              label="主按钮"
            />
            <CardActionEditor
              :action="ensureAction(item, 'secondaryAction')"
              :page-options="internalPageOptions"
              label="次按钮"
            />
          </template>
        </RepeaterEditor>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>

<style scoped>
.card-image-preview {
  width: 56px;
  height: 40px;
  object-fit: cover;
  border: 1px solid var(--vtsuru-border);
  border-radius: 4px;
}
</style>
