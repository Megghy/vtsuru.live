<script setup lang="ts">
import { ImageIcon, Plus } from 'lucide-vue-next'
import { ref } from 'vue'

import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import CardActionEditor from './CardActionEditor.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps, ensureArrayProp, propertyAvailable, internalPageOptions } = useBlockPropsEditor(
  () => props.block,
)
const items = ensureArrayProp<Record<string, any>>('items')
const newTagInput = ref<Record<number, string>>({})

function ensureAction(item: Record<string, any>, key: 'primaryAction' | 'secondaryAction') {
  item[key] ??= key === 'primaryAction' ? { label: '', page: 'home' } : { label: '', url: 'https://' }
  return item[key]
}

function addTag(item: Record<string, any>, index: number) {
  const val = (newTagInput.value[index] || '').trim()
  if (!val) return
  item.tags = Array.isArray(item.tags) ? item.tags : []
  if (!item.tags.includes(val)) {
    item.tags.push(val)
  }
  newTagInput.value[index] = ''
}

function removeTag(item: Record<string, any>, tagIdx: number | string) {
  if (Array.isArray(item.tags)) {
    item.tags.splice(Number(tagIdx), 1)
  }
}
</script>

<template>
  <div class="space-y-3">
    <PropsGrid>
      <FormField label="布局">
        <Select v-model="blockProps.layout">
          <SelectTrigger>
            <SelectValue placeholder="布局" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">网格</SelectItem>
            <SelectItem value="list">列表</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField
        v-if="propertyAvailable('columns')"
        label="列数"
      >
        <NumberField
          v-model="blockProps.columns"
          :min="1"
          :max="4"
          class="w-full"
        />
      </FormField>
      <FormField
        label="卡片"
        class="span-full"
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
              <FormField
                label="图片"
                class="span-full"
              >
                <div class="flex items-center gap-2">
                  <Button
                    variant="outline"
                    :loading="editor.isUploading.value"
                    @click="editor.triggerUploadItemImage(props.block, index)"
                  >
                    <ImageIcon class="mr-1.5 size-3.5" />
                    选择图片
                  </Button>
                  <Button
                    variant="ghost"
                    :disabled="!item.imageFile"
                    @click="editor.clearUploadedItemImage(props.block, index)"
                  >
                    清除
                  </Button>
                  <ImagePreview
                    v-if="item.imageFile?.path"
                    :src="item.imageFile.path"
                    :alt="item.title || '卡片图片'"
                    class="w-14 h-10 border-border rounded shrink-0"
                  />
                </div>
              </FormField>
              <FormField label="标题">
                <Input
                  v-model="item.title"
                  maxlength="100"
                />
              </FormField>
              <FormField
                label="正文"
                class="span-full"
              >
                <Textarea
                  v-model="item.body"
                  maxlength="1000"
                  rows="3"
                />
              </FormField>
              <FormField
                label="标签"
                class="span-full"
              >
                <div class="flex flex-wrap items-center gap-1.5">
                  <Tag
                    v-for="(t, tagIdx) in item.tags || []"
                    :key="tagIdx"
                    closable
                    size="small"
                    @close="removeTag(item, tagIdx)"
                  >
                    {{ t }}
                  </Tag>
                  <div class="flex items-center gap-1">
                    <Input
                      v-model="newTagInput[index]"
                      placeholder="新标签"
                      size="xs"
                      class="w-20"
                      @keydown.enter.prevent="addTag(item, index)"
                    />
                    <Button size="xs" variant="outline" class="px-1.5" @click="addTag(item, index)">
                      <Plus class="size-3" />
                    </Button>
                  </div>
                </div>
              </FormField>
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
      </FormField>
    </PropsGrid>
  </div>
</template>
