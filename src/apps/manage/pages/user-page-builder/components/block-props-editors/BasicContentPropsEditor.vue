<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import RichTextEditor from '@/apps/user-page/editor/RichTextEditor.vue'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <div
    class="builder-form"
    v-if="props.block.type === 'profile'"
  >
    <PropsGrid>
      <UFormField label="显示名称">
        <UInput
          v-model="blockProps.displayName"
          placeholder="为空则显示账号名"
        />
      </UFormField>
      <UFormField
        class="span-full"
        label="头像图片"
      >
        <div class="builder-row">
          <UButton
            size="sm"
            :loading="editor.isUploading.value"
            @click="editor.triggerUpload(props.block, 'avatarFile')"
          >
            <template #icon>
              <UIcon name="i-lucide-circle-user-round" />
            </template>
            上传头像
          </UButton>
          <UButton
            size="sm"
            variant="soft"
            :disabled="!blockProps.avatarFile"
            @click="editor.clearUploadedFile(props.block, 'avatarFile')"
          >
            清除
          </UButton>
          <span class="builder-text">
            {{ blockProps.avatarFile?.name || blockProps.avatarFile?.path || '' }}
          </span>
        </div>
      </UFormField>
      <UFormField
        class="span-full"
        label="个人简介"
      >
        <UTextarea
          v-model="blockProps.bio"
          :autosize="{ minRows: 2, maxRows: 6 }"
        />
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'heading'"
  >
    <PropsGrid>
      <UFormField label="标题文字">
        <UInput
          v-model="blockProps.text"
          placeholder="请输入标题"
        />
      </UFormField>
      <UFormField label="标题级别 1/2/3">
        <UInputNumber
          v-model="blockProps.level"
          :min="1"
          :max="3"
          style="width: 100%"
        />
      </UFormField>
    </PropsGrid>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'text'"
  >
    <UFormField label="文本内容">
      <UTextarea
        v-model="blockProps.text"
        :autosize="{ minRows: 6, maxRows: 14 }"
      />
    </UFormField>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'richText'"
  >
    <UFormField label="富文本内容">
      <RichTextEditor
        v-model:html="editor.ensureRichTextProps(props.block).html"
        v-model:images-file="editor.ensureRichTextProps(props.block).imagesFile"
      />
    </UFormField>
  </div>

  <div
    class="builder-form"
    v-else-if="props.block.type === 'alert'"
  >
    <PropsGrid>
      <UFormField label="提示类型">
        <USelect
          v-model="blockProps.type"
          :items="[
            { label: '信息', value: 'info' },
            { label: '成功', value: 'success' },
            { label: '警告', value: 'warning' },
            { label: '错误', value: 'error' },
            { label: '默认', value: 'default' },
          ]"
        />
      </UFormField>
      <UFormField label="标题">
        <UInput
          v-model="blockProps.title"
          placeholder="可选"
        />
      </UFormField>
      <UFormField
        class="span-full"
        label="内容"
      >
        <UTextarea
          v-model="blockProps.text"
          :autosize="{ minRows: 3, maxRows: 8 }"
          placeholder="请输入提示内容"
        />
      </UFormField>
      <UFormField label="显示图标">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showIcon"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示边框">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.bordered"
            size="small"
          />
        </div>
      </UFormField>
    </PropsGrid>
  </div>
</template>
