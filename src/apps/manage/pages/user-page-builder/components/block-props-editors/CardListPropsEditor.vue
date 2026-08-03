<script setup lang="ts">
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
  <div class="builder-form">
    <PropsGrid>
      <UFormField label="布局">
        <USelect
          v-model="blockProps.layout"
          :items="[
            { label: '网格', value: 'grid' },
            { label: '列表', value: 'list' },
          ]"
        />
      </UFormField>
      <UFormField
        v-if="propertyAvailable('columns')"
        label="列数"
      >
        <UInputNumber
          v-model="blockProps.columns"
          :min="1"
          :max="4"
          style="width: 100%"
        />
      </UFormField>
      <UFormField
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
              <UFormField
                class="span-full"
                label="图片"
              >
                <div class="builder-row">
                  <UButton
                    size="sm"
                    :loading="editor.isUploading.value"
                    @click="editor.triggerUploadItemImage(props.block, index)"
                  >
                    <template #icon>
                      <UIcon name="i-lucide-image" />
                    </template>
                    选择图片
                  </UButton>
                  <UButton
                    size="sm"
                    variant="soft"
                    :disabled="!item.imageFile"
                    @click="editor.clearUploadedItemImage(props.block, index)"
                  >
                    清除
                  </UButton>
                  <img
                    v-if="item.imageFile?.path"
                    :src="item.imageFile.path"
                    alt=""
                    class="card-image-preview"
                  />
                </div>
              </UFormField>
              <UFormField label="标题">
                <UInput
                  v-model="item.title"
                  maxlength="100"
                  show-count
                />
              </UFormField>
              <UFormField
                class="span-full"
                label="正文"
              >
                <UTextarea
                  v-model="item.body"
                  maxlength="1000"
                  show-count
                  :autosize="{ minRows: 3, maxRows: 8 }"
                />
              </UFormField>
              <UFormField
                class="span-full"
                label="标签"
              >
                <UInputTags v-model="item.tags" />
              </UFormField>
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
      </UFormField>
    </PropsGrid>
  </div>
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
