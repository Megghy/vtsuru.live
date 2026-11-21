<script setup lang="ts">
import { Image as ImageIcon } from 'lucide-vue-next'

import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'

import PropsGrid from '../PropsGrid.vue'
import RepeaterEditor from '../RepeaterEditor.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps, arrayProp } = useBlockPropsEditor(() => props.block)

const ocImages = arrayProp<Record<string, any>>('images')
const ocPalette = arrayProp<Record<string, any>>('palette')
const ocSpecs = arrayProp<Record<string, any>>('specs')
const ocCredits = arrayProp<Record<string, any>>('credits')

const urlPlaceholder = 'https://...'

function clearImageFile(target: Record<string, any>) {
  delete target.imageFile
}

function uploadOcImage(index: number) {
  editor.triggerUploadTargetImage(() => ocImages.value[index], 'imageFile')
}
</script>

<template>
  <PropsGrid>
    <FormField label="区块标题">
      <Input
        v-model="blockProps.title"
        maxlength="60"
        placeholder="OC 设定集"
      />
    </FormField>
    <FormField label="角色名">
      <Input
        v-model="blockProps.characterName"
        maxlength="60"
        placeholder="例如：星见露娜"
      />
    </FormField>
    <FormField
      label="副标题 / 身份标签"
      class="span-full"
    >
      <Input
        v-model="blockProps.subtitle"
        maxlength="100"
        placeholder="例如：来自深海的歌姬 · 158cm · 10月24日"
      />
    </FormField>
    <FormField
      label="角色简介"
      class="span-full"
    >
      <Textarea
        v-model="blockProps.bio"
        rows="3"
        maxlength="800"
        placeholder="介绍世界观、性格特征与画师约稿注意事项..."
      />
    </FormField>

    <FormField
      label="立绘 / 三视图（最多 8 张）"
      class="span-full"
    >
      <RepeaterEditor
        :items="ocImages"
        :create-item="() => ({ label: '常规立绘' })"
        add-text="添加立绘"
      >
        <template #title="{ item, index }">
          {{ item.label || `立绘 ${index + 1}` }}
        </template>
        <template #default="{ item, index }">
          <PropsGrid>
            <FormField
              label="标签名称"
              class="span-full"
            >
              <Input
                v-model="item.label"
                maxlength="40"
                placeholder="例如：常服 / 三视图 / 礼服"
              />
            </FormField>
            <FormField
              label="立绘图片"
              class="span-full"
            >
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  class="gap-1.5"
                  :disabled="editor.isUploading.value"
                  @click="uploadOcImage(index)"
                >
                  <ImageIcon class="size-3.5" />
                  上传立绘
                </Button>
                <Button
                  variant="ghost"
                  :disabled="!item.imageFile"
                  @click="clearImageFile(item)"
                >
                  清除
                </Button>
                <ImagePreview
                  v-if="item.imageFile?.path"
                  :src="item.imageFile.path"
                  :alt="item.label || '立绘预览'"
                  class="size-8 rounded border border-border shrink-0"
                />
              </div>
            </FormField>
          </PropsGrid>
        </template>
      </RepeaterEditor>
    </FormField>

    <FormField
      label="官方色卡（点击一键复制 HEX）"
      class="span-full"
    >
      <RepeaterEditor
        :items="ocPalette"
        :create-item="() => ({ name: '主色', hex: '#38bdf8' })"
        add-text="添加色卡"
      >
        <template #title="{ item, index }">
          {{ item.name || item.hex || `色卡 ${index + 1}` }}
        </template>
        <template #default="{ item }">
          <PropsGrid>
            <FormField label="部位 / 名称">
              <Input
                v-model="item.name"
                maxlength="30"
                placeholder="如：发色 / 瞳色"
              />
            </FormField>
            <FormField label="颜色">
              <ColorPicker
                v-model="item.hex"
                :show-alpha="false"
              />
            </FormField>
          </PropsGrid>
        </template>
      </RepeaterEditor>
    </FormField>

    <FormField
      label="设定参数（身高 / 生日 / 喜好等）"
      class="span-full"
    >
      <RepeaterEditor
        :items="ocSpecs"
        :create-item="() => ({ label: '身高', value: '' })"
        add-text="添加参数"
      >
        <template #title="{ item, index }">
          {{ item.label ? `${item.label}：${item.value || ''}` : `参数 ${index + 1}` }}
        </template>
        <template #default="{ item }">
          <PropsGrid>
            <FormField label="属性名">
              <Input
                v-model="item.label"
                maxlength="30"
                placeholder="如：身高"
              />
            </FormField>
            <FormField label="设定值">
              <Input
                v-model="item.value"
                maxlength="80"
                placeholder="如：160cm"
              />
            </FormField>
          </PropsGrid>
        </template>
      </RepeaterEditor>
    </FormField>

    <FormField
      label="绘师 / 建模师署名"
      class="span-full"
    >
      <RepeaterEditor
        :items="ocCredits"
        :create-item="() => ({ role: '画师妈妈', name: '', url: '' })"
        add-text="添加署名"
      >
        <template #title="{ item, index }">
          {{ item.role || item.name ? `${item.role || ''} ${item.name || ''}`.trim() : `署名 ${index + 1}` }}
        </template>
        <template #default="{ item }">
          <PropsGrid>
            <FormField label="身份">
              <Input
                v-model="item.role"
                maxlength="30"
                placeholder="如：立绘 / Live2D"
              />
            </FormField>
            <FormField label="署名">
              <Input
                v-model="item.name"
                maxlength="60"
                placeholder="老师昵称"
              />
            </FormField>
            <FormField
              label="主页链接（可选）"
              class="span-full"
            >
              <Input
                v-model="item.url"
                :placeholder="urlPlaceholder"
              />
            </FormField>
          </PropsGrid>
        </template>
      </RepeaterEditor>
    </FormField>
  </PropsGrid>
</template>
