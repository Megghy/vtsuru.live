<script setup lang="ts">
import { ImageIcon, Plus, X } from 'lucide-vue-next'
import { ref } from 'vue'

import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
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
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">布局</label>
        <Select v-model="blockProps.layout">
          <SelectTrigger>
            <SelectValue placeholder="布局" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">网格</SelectItem>
            <SelectItem value="list">列表</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        v-if="propertyAvailable('columns')"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">列数</label>
        <NumberField
          v-model="blockProps.columns"
          :min="1"
          :max="4"
          class="w-full"
        />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">卡片</label>
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
              <div class="span-full space-y-1">
                <label class="text-xs text-muted-foreground">图片</label>
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
                  <img
                    v-if="item.imageFile?.path"
                    :src="item.imageFile.path"
                    alt=""
                    class="w-14 h-10 object-cover border border-border rounded"
                  />
                </div>
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted-foreground">标题</label>
                <Input
                  v-model="item.title"
                  maxlength="100"
                />
              </div>
              <div class="span-full space-y-1">
                <label class="text-xs text-muted-foreground">正文</label>
                <Textarea
                  v-model="item.body"
                  maxlength="1000"
                  rows="3"
                  class="text-xs"
                />
              </div>
              <div class="span-full space-y-1">
                <label class="text-xs text-muted-foreground">标签</label>
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
                      class="h-6 w-20 px-2"
                      @keydown.enter.prevent="addTag(item, index)"
                    />
                    <Button
                      variant="outline"
                      class="h-6 px-1.5"
                      @click="addTag(item, index)"
                    >
                      <Plus class="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
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
      </div>
    </PropsGrid>
  </div>
</template>

