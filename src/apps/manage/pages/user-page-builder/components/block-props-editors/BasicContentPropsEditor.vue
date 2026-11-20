<script setup lang="ts">
import PersonCircleOutline from '@vicons/ionicons5/es/PersonCircleOutline'
import { defineAsyncComponent } from 'vue'

import type { BlockNode } from '@/apps/user-page/block/schema'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

import PropsGrid from '../PropsGrid.vue'
import TextAppearanceFields from './TextAppearanceFields.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const RichTextEditor = defineAsyncComponent(() => import('@/apps/user-page/editor/RichTextEditor.vue'))

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <div
    v-if="props.block.type === 'profile'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField label="显示名称">
        <Input
          v-model="blockProps.displayName"
          placeholder="为空则显示账号名"
        />
      </FormField>
      <FormField
        label="头像图片"
        class="span-full"
      >
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            class="gap-1.5"
            :disabled="editor.isUploading.value"
            @click="editor.triggerUpload(props.block, 'avatarFile')"
          >
            <PersonCircleOutline class="size-4" />
            上传头像
          </Button>
          <Button
            variant="ghost"
            :disabled="!blockProps.avatarFile"
            @click="editor.clearUploadedFile(props.block, 'avatarFile')"
          >
            清除
          </Button>
          <span class="text-xs text-muted-foreground truncate max-w-[200px]">
            {{ blockProps.avatarFile?.name || blockProps.avatarFile?.path || '' }}
          </span>
        </div>
      </FormField>
      <FormField
        label="个人简介"
        class="span-full"
      >
        <Textarea
          v-model="blockProps.bio"
          class="min-h-[60px]"
          placeholder="个人简介"
        />
      </FormField>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'heading'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField label="标题文字">
        <Input
          v-model="blockProps.text"
          placeholder="请输入标题"
        />
      </FormField>
      <FormField label="标题级别 1/2/3">
        <NumberField
          v-model="blockProps.level"
          :min="1"
          :max="3"
          class="w-full"
        />
      </FormField>
      <TextAppearanceFields :block="props.block" />
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'text'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField
        label="文本内容"
        class="span-full"
      >
        <Textarea
          v-model="blockProps.text"
          class="min-h-[120px]"
          placeholder="请输入文本"
        />
      </FormField>
      <TextAppearanceFields :block="props.block" />
    </PropsGrid>
  </div>

  <FormField
    v-else-if="props.block.type === 'richText'"
    label="富文本内容"
  >
    <RichTextEditor
      v-model:html="editor.ensureRichTextProps(props.block).html"
      v-model:images-file="editor.ensureRichTextProps(props.block).imagesFile"
    />
  </FormField>

  <div
    v-else-if="props.block.type === 'alert'"
    class="space-y-3"
  >
    <PropsGrid>
      <FormField label="提示类型">
        <Select v-model="blockProps.type">
          <SelectTrigger>
            <SelectValue placeholder="提示类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">信息</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="warning">警告</SelectItem>
            <SelectItem value="error">错误</SelectItem>
            <SelectItem value="default">默认</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="标题">
        <Input
          v-model="blockProps.title"
          placeholder="可选"
        />
      </FormField>
      <FormField
        label="内容"
        class="span-full"
      >
        <Textarea
          v-model="blockProps.text"
          placeholder="请输入提示内容"
          class="min-h-[70px]"
        />
      </FormField>
      <SettingRow
        title="显示图标"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.showIcon" />
      </SettingRow>
      <SettingRow
        title="显示边框"
        variant="none"
        class="py-1"
      >
        <Switch v-model:checked="blockProps.bordered" />
      </SettingRow>
    </PropsGrid>
  </div>
</template>
