<script setup lang="ts">
import { PersonCircleOutline } from '@vicons/ionicons5'

import type { BlockNode } from '@/apps/user-page/block/schema'
import RichTextEditor from '@/apps/user-page/editor/RichTextEditor.vue'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

import PropsGrid from '../PropsGrid.vue'
import TextAppearanceFields from './TextAppearanceFields.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <div
    v-if="props.block.type === 'profile'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">显示名称</label>
        <Input
          v-model="blockProps.displayName"
          placeholder="为空则显示账号名"
          class="h-8 text-xs"
        />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">头像图片</label>
        <div class="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            class="h-8 text-xs gap-1.5"
            :disabled="editor.isUploading.value"
            @click="editor.triggerUpload(props.block, 'avatarFile')"
          >
            <PersonCircleOutline class="size-4" />
            上传头像
          </Button>
          <Button
            size="sm"
            variant="ghost"
            class="h-8 text-xs"
            :disabled="!blockProps.avatarFile"
            @click="editor.clearUploadedFile(props.block, 'avatarFile')"
          >
            清除
          </Button>
          <span class="text-xs text-muted-foreground truncate max-w-[200px]">
            {{ blockProps.avatarFile?.name || blockProps.avatarFile?.path || '' }}
          </span>
        </div>
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">个人简介</label>
        <Textarea
          v-model="blockProps.bio"
          class="text-xs min-h-[60px]"
          placeholder="个人简介"
        />
      </div>
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'heading'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">标题文字</label>
        <Input
          v-model="blockProps.text"
          placeholder="请输入标题"
          class="h-8 text-xs"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">标题级别 1/2/3</label>
        <NInputNumber
          v-model:value="blockProps.level"
          :min="1"
          :max="3"
          class="w-full"
        />
      </div>
      <TextAppearanceFields :block="props.block" />
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'text'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">文本内容</label>
        <Textarea
          v-model="blockProps.text"
          class="text-xs min-h-[120px]"
          placeholder="请输入文本"
        />
      </div>
      <TextAppearanceFields :block="props.block" />
    </PropsGrid>
  </div>

  <div
    v-else-if="props.block.type === 'richText'"
    class="space-y-2"
  >
    <label class="text-xs text-muted-foreground font-medium">富文本内容</label>
    <RichTextEditor
      v-model:html="editor.ensureRichTextProps(props.block).html"
      v-model:images-file="editor.ensureRichTextProps(props.block).imagesFile"
    />
  </div>

  <div
    v-else-if="props.block.type === 'alert'"
    class="space-y-3"
  >
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">提示类型</label>
        <Select v-model="blockProps.type">
          <SelectTrigger class="h-8 text-xs">
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
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">标题</label>
        <Input
          v-model="blockProps.title"
          placeholder="可选"
          class="h-8 text-xs"
        />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">内容</label>
        <Textarea
          v-model="blockProps.text"
          placeholder="请输入提示内容"
          class="text-xs min-h-[70px]"
        />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示图标</label>
        <Switch v-model:checked="blockProps.showIcon" />
      </div>
      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示边框</label>
        <Switch v-model:checked="blockProps.bordered" />
      </div>
    </PropsGrid>
  </div>
</template>
